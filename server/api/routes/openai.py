import asyncio
import json
import time
import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, StreamingResponse

from api.dependencies import verify_api_key
from api.openai_stream import start_openai_sse_chat
from api.runtime import app_state
from api.schemas import OpenAIChatCompletionRequest

router = APIRouter(dependencies=[Depends(verify_api_key)])


def openai_error_response(
    *,
    message: str,
    status_code: int,
    error_type: str = 'invalid_request_error',
    code: str | None = None,
    param: str | None = None,
):
    return JSONResponse(
        status_code=status_code,
        content={
            'error': {
                'message': message,
                'type': error_type,
                'param': param,
                'code': code,
            }
        },
    )


def _normalize_params(payload: OpenAIChatCompletionRequest) -> Dict[str, Any]:
    merged: Dict[str, Any] = {
        **(payload.params or {}),
    }
    if payload.temperature is not None:
        merged['temperature'] = payload.temperature
    if payload.max_tokens is not None:
        merged['max_tokens'] = payload.max_tokens
    if payload.top_p is not None:
        merged['top_p'] = payload.top_p
    if payload.stop is not None:
        merged['stop'] = payload.stop
    return merged


@router.get('/v1/models')
async def list_openai_models():
    loop = asyncio.get_running_loop()
    models = await loop.run_in_executor(app_state.executor, app_state.model_manager.list_models)
    now_ts = int(time.time())
    return {
        'object': 'list',
        'data': [
            {
                'id': model.get('name', ''),
                'object': 'model',
                'created': now_ts,
                'owned_by': 'local',
                'permission': [],
            }
            for model in (models or [])
        ],
    }


@router.get('/v1/models/{model_id}')
async def get_openai_model(model_id: str):
    loop = asyncio.get_running_loop()
    models = await loop.run_in_executor(app_state.executor, app_state.model_manager.list_models)
    found = next((m for m in (models or []) if m.get('name') == model_id), None)
    if not found:
        return openai_error_response(
            message=f"The model '{model_id}' does not exist",
            status_code=404,
            error_type='invalid_request_error',
            code='model_not_found',
            param='model',
        )

    return {
        'id': found.get('name', model_id),
        'object': 'model',
        'created': int(time.time()),
        'owned_by': 'local',
        'permission': [],
    }


@router.post('/v1/chat/completions')
async def openai_chat_completions(payload: OpenAIChatCompletionRequest):
    if not payload.messages:
        return openai_error_response(
            message="'messages' is required",
            status_code=400,
            code='messages_required',
            param='messages',
        )

    user_messages = [m for m in payload.messages if m.role == 'user' and m.content]
    user_input = user_messages[-1].content if user_messages else ''
    if not user_input:
        return openai_error_response(
            message='The last user message content is required',
            status_code=400,
            code='content_required',
            param='messages',
        )

    conversation_id = payload.conversation_id or 'default_conv'
    messages: List[Dict[str, Any]] = [m.model_dump() for m in payload.messages]
    merged_params = _normalize_params(payload)

    if payload.stream and payload.client_id:
        try:
            started = await start_openai_sse_chat(
                app_state,
                client_id=payload.client_id,
                conversation_id=conversation_id,
                user_input=user_input,
                messages=messages,
                params=merged_params,
                request_id=payload.request_id,
            )
        except ValueError as exc:
            return openai_error_response(
                message=str(exc),
                status_code=404,
                error_type='not_found_error',
                code='sse_client_not_connected',
            )

        return {
            'id': started['chat_id'],
            'object': 'chat.completion',
            'created': started['created'],
            'model': app_state.llm_engine.model_name or payload.model or 'local-model',
            'choices': [
                {
                    'index': 0,
                    'message': {'role': 'assistant', 'content': ''},
                    'finish_reason': None,
                }
            ],
            'request_id': started['request_id'],
            'conversation_id': conversation_id,
        }

    if payload.stream:
        completion_id = f'chatcmpl-{uuid.uuid4()}'
        created = int(time.time())
        model_name = app_state.llm_engine.model_name or payload.model or 'local-model'
        queue: asyncio.Queue[Any] = asyncio.Queue()

        async def status_cb(_msg: str):
            return None

        async def chunk_cb(chunk: str):
            await queue.put(chunk)

        async def _runner():
            try:
                await app_state.chat_orchestrator.process_chat(
                    conversation_id,
                    user_input,
                    merged_params,
                    status_cb,
                    chunk_cb,
                    messages=messages,
                )
                await queue.put(None)
            except Exception as exc:
                await queue.put(exc)

        task = asyncio.create_task(_runner())

        async def event_stream():
            first = {
                'id': completion_id,
                'object': 'chat.completion.chunk',
                'created': created,
                'model': model_name,
                'choices': [{'index': 0, 'delta': {'role': 'assistant'}, 'finish_reason': None}],
            }
            yield f"data: {json.dumps(first, ensure_ascii=False)}\n\n"

            while True:
                item = await queue.get()
                if item is None:
                    break
                if isinstance(item, Exception):
                    err_obj = {
                        'error': {
                            'message': str(item),
                            'type': 'server_error',
                            'param': None,
                            'code': 'completion_failed',
                        }
                    }
                    yield f"data: {json.dumps(err_obj, ensure_ascii=False)}\n\n"
                    yield 'data: [DONE]\n\n'
                    return

                chunk = {
                    'id': completion_id,
                    'object': 'chat.completion.chunk',
                    'created': created,
                    'model': model_name,
                    'choices': [{'index': 0, 'delta': {'content': str(item)}, 'finish_reason': None}],
                }
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

            final_chunk = {
                'id': completion_id,
                'object': 'chat.completion.chunk',
                'created': created,
                'model': model_name,
                'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}],
            }
            yield f"data: {json.dumps(final_chunk, ensure_ascii=False)}\n\n"
            yield 'data: [DONE]\n\n'
            await task

        return StreamingResponse(event_stream(), media_type='text/event-stream')

    chunks: List[str] = []

    async def status_cb(_msg: str):
        return None

    async def chunk_cb(chunk: str):
        chunks.append(chunk)

    try:
        await app_state.chat_orchestrator.process_chat(
            conversation_id,
            user_input,
            merged_params,
            status_cb,
            chunk_cb,
            messages=messages,
        )
    except Exception as exc:
        return openai_error_response(
            message=str(exc),
            status_code=500,
            error_type='server_error',
            code='completion_failed',
        )

    content = ''.join(chunks)
    completion_id = f'chatcmpl-{uuid.uuid4()}'
    created = int(time.time())
    model_name = app_state.llm_engine.model_name or payload.model or 'local-model'
    prompt_tokens = sum(max(1, len((m.get('content') or '').split())) for m in messages)
    completion_tokens = max(1, len(content.split())) if content else 0

    return {
        'id': completion_id,
        'object': 'chat.completion',
        'created': created,
        'model': model_name,
        'choices': [
            {
                'index': 0,
                'message': {'role': 'assistant', 'content': content},
                'finish_reason': 'stop',
            }
        ],
        'usage': {
            'prompt_tokens': prompt_tokens,
            'completion_tokens': completion_tokens,
            'total_tokens': prompt_tokens + completion_tokens,
        },
    }
