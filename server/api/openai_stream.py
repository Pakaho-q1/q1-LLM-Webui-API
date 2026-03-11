import asyncio
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        texts: List[str] = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text" and isinstance(part.get("text"), str):
                texts.append(part["text"])
        return "\n".join(t for t in texts if t.strip())
    return ""


def _build_prompt_text(messages: List[Dict[str, Any]]) -> str:
    parts: List[str] = []
    for message in messages:
        role = str(message.get("role") or "")
        text = _extract_text(message.get("content"))
        if text:
            parts.append(f"{role}:{text}")
    return "\n".join(parts)


def _estimate_tokens(text: str) -> int:
    clean = (text or "").strip()
    if not clean:
        return 0
    return max(1, len(clean) // 4)


def _extract_params(params: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(params or {})
    explicit = {
        "temperature": normalized.pop("temperature", None),
        "max_tokens": normalized.pop("max_tokens", None),
        "top_p": normalized.pop("top_p", None),
        "stop": normalized.pop("stop", None),
    }
    for key, value in explicit.items():
        if value is not None:
            normalized[key] = value
    return normalized


async def start_openai_sse_chat(
    app_state: Any,
    *,
    client_id: str,
    conversation_id: str,
    user_input: str,
    messages: Optional[List[Dict[str, Any]]] = None,
    params: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None,
    prompt_tokens: Optional[int] = None,
) -> Dict[str, Any]:
    queue = await app_state.get_sse_queue(client_id)
    if not queue:
        raise ValueError("SSE client not connected")

    req_id = request_id or str(uuid.uuid4())
    chat_id = f"chatcmpl-{uuid.uuid4()}"
    created = int(time.time())
    normalized_params = _extract_params(params or {})
    started_at = time.perf_counter()
    loop = asyncio.get_running_loop()
    if prompt_tokens is None:
        prompt_text = _build_prompt_text(messages or [])
        try:
            prompt_tokens = await loop.run_in_executor(
                app_state.executor,
                app_state.llm_provider.count_tokens,
                prompt_text,
            )
        except Exception:
            prompt_tokens = _estimate_tokens(prompt_text)

    async def _runner():
        try:
            async def status_cb(msg: str):
                await app_state.put_sse_message(
                    client_id,
                    {
                        "type": "status",
                        "message": msg,
                        "request_id": req_id,
                    },
                )

            async def chunk_cb(chunk: str):
                nonlocal prompt_tokens
                now = time.perf_counter()
                if not state["first_chunk_at"]:
                    state["first_chunk_at"] = now
                state["generated_text"].append(chunk)
                generated_joined = "".join(state["generated_text"])
                generated_tokens = _estimate_tokens(generated_joined)
                prompt_processing_time_ms = max(1, int((state["first_chunk_at"] - started_at) * 1000))
                generation_time_ms = max(1, int((now - state["first_chunk_at"]) * 1000))
                openai_chunk = {
                    "id": chat_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": app_state.llm_provider.model_name or "local-model",
                    "request_id": req_id,
                    "choices": [{"index": 0, "delta": {"content": chunk}, "finish_reason": None}],
                    "metrics": {
                        "prompt_tokens": prompt_tokens,
                        "prompt_processing_time_ms": prompt_processing_time_ms,
                        "prompt_tokens_per_sec": round(prompt_tokens / (prompt_processing_time_ms / 1000), 2)
                        if prompt_processing_time_ms > 0
                        else 0.0,
                        "generated_tokens": generated_tokens,
                        "generation_time_ms": generation_time_ms,
                        "generation_tokens_per_sec": round(generated_tokens / (generation_time_ms / 1000), 2)
                        if generation_time_ms > 0
                        else 0.0,
                        "total_time_ms": max(1, int((now - started_at) * 1000)),
                    },
                }
                await app_state.put_sse_message(client_id, {"__openai_chunk": openai_chunk})

            state: Dict[str, Any] = {
                "generated_text": [],
                "first_chunk_at": None,
            }

            await app_state.chat_orchestrator.process_chat(
                conversation_id,
                user_input,
                normalized_params,
                status_cb,
                chunk_cb,
                messages=messages,
            )

            completed_at = time.perf_counter()
            full_text = "".join(state["generated_text"])
            try:
                final_generated_tokens = await loop.run_in_executor(
                    app_state.executor,
                    app_state.llm_provider.count_tokens,
                    full_text,
                )
            except Exception:
                final_generated_tokens = _estimate_tokens(full_text)
            prompt_processing_time_ms = (
                max(1, int((state["first_chunk_at"] - started_at) * 1000))
                if state["first_chunk_at"] is not None
                else max(1, int((completed_at - started_at) * 1000))
            )
            generation_time_ms = (
                max(1, int((completed_at - state["first_chunk_at"]) * 1000))
                if state["first_chunk_at"] is not None
                else 1
            )
            final_chunk = {
                "id": chat_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": app_state.llm_provider.model_name or "local-model",
                "request_id": req_id,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                "metrics": {
                    "prompt_tokens": prompt_tokens,
                    "prompt_processing_time_ms": prompt_processing_time_ms,
                    "prompt_tokens_per_sec": round(prompt_tokens / (prompt_processing_time_ms / 1000), 2)
                    if prompt_processing_time_ms > 0
                    else 0.0,
                    "generated_tokens": final_generated_tokens,
                    "generation_time_ms": generation_time_ms,
                    "generation_tokens_per_sec": round(final_generated_tokens / (generation_time_ms / 1000), 2)
                    if generation_time_ms > 0
                    else 0.0,
                    "total_time_ms": max(1, int((completed_at - started_at) * 1000)),
                },
            }
            await app_state.put_sse_message(client_id, {"__openai_chunk": final_chunk})
            await app_state.put_sse_message(client_id, {"__openai_done": True})
        except Exception as exc:
            logger.exception("OpenAI SSE bridge failed")
            await app_state.put_sse_message(client_id, {"type": "error", "message": str(exc)})

    asyncio.create_task(_runner())
    return {"chat_id": chat_id, "created": created, "request_id": req_id}
