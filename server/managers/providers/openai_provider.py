from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Generator, List

import requests

from managers.providers.base import LLMProvider
from managers.providers.params import CANONICAL_CHAT_PARAMS, normalize_canonical_chat_params

logger = logging.getLogger(__name__)


class OpenAIProvider(LLMProvider):
    provider_name = "openai"

    def __init__(self, config: Dict[str, Any] | None = None) -> None:
        cfg = dict(config or {})
        self._base_url = str(
            cfg.get("base_url")
            or os.environ.get("OPENAI_PROVIDER_BASE_URL")
            or "https://api.openai.com/v1"
        ).rstrip("/")
        self._api_key = str(cfg.get("api_key") or os.environ.get("OPENAI_PROVIDER_API_KEY") or "").strip()
        self._default_model = str(
            cfg.get("model")
            or os.environ.get("OPENAI_PROVIDER_MODEL")
            or "gpt-4o-mini"
        ).strip()
        self._current_model = self._default_model
        self._n_ctx = int(cfg.get("n_ctx") or os.environ.get("OPENAI_PROVIDER_N_CTX") or 8192)
        self._multimodal_enabled = (
            str(cfg.get("multimodal_enabled") or os.environ.get("OPENAI_PROVIDER_MULTIMODAL_ENABLED") or "true")
            .strip()
            .lower()
            in {"1", "true", "yes", "on"}
        )

    @property
    def model_name(self) -> str:
        return self._current_model

    @property
    def n_ctx(self) -> int:
        return self._n_ctx

    @property
    def multimodal_enabled(self) -> bool:
        return self._multimodal_enabled

    @property
    def mmproj_path(self) -> str:
        return ""

    @property
    def chat_format(self) -> str:
        return "openai-chat"

    def _headers(self) -> Dict[str, str]:
        if not self._api_key:
            raise ValueError("OpenAI provider requires api_key")
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def _resolve_model(self, params: Dict[str, Any]) -> str:
        candidate = str(params.get("model") or self._current_model or self._default_model or "").strip()
        if not candidate:
            raise ValueError("No model selected for OpenAI provider.")
        self._current_model = candidate
        return candidate

    def _build_payload(self, messages: List[Dict[str, Any]], params: Dict[str, Any], stream: bool) -> Dict[str, Any]:
        canonical, _ = normalize_canonical_chat_params(params)
        model = self._resolve_model(canonical or params)
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": stream,
        }

        passthrough_keys = [
            "temperature",
            "top_p",
            "max_tokens",
            "stop",
            "top_k",
            "seed",
            "presence_penalty",
            "frequency_penalty",
        ]
        for key in passthrough_keys:
            if canonical.get(key) is not None:
                payload[key] = canonical[key]
        return payload

    def is_loaded(self) -> bool:
        try:
            r = requests.get(
                f"{self._base_url}/models",
                headers=self._headers(),
                timeout=8,
            )
            return r.ok
        except Exception:
            return False

    def load_model(self, model_path: str, **params: Any) -> tuple[bool, str]:
        model = str(params.get("model") or model_path or "").strip()
        if not model:
            return False, "model is required for OpenAI provider"
        self._current_model = model
        return True, f"OpenAI active model set to: {model}"

    def unload_model(self) -> None:
        self._current_model = self._default_model

    def count_tokens(self, text: str) -> int:
        return max(1, len((text or "")) // 3)

    def supported_chat_params(self) -> List[str]:
        return [
            "model",
            "temperature",
            "top_p",
            "max_tokens",
            "stop",
            "seed",
            "presence_penalty",
            "frequency_penalty",
        ]

    def unsupported_chat_params(self, params: Dict[str, Any]) -> List[str]:
        supported = set(self.supported_chat_params())
        unsupported: List[str] = []
        for key in (params or {}).keys():
            key_s = str(key)
            if key_s.startswith("_") or key_s == "parameters":
                continue
            if key_s in CANONICAL_CHAT_PARAMS and key_s not in supported:
                unsupported.append(key_s)
            elif key_s not in CANONICAL_CHAT_PARAMS:
                unsupported.append(key_s)
        return sorted(set(unsupported))

    def generate_json(self, messages: List[Dict[str, Any]], params: Dict[str, Any]) -> str:
        try:
            payload = self._build_payload(messages, params, stream=False)
            r = requests.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
                timeout=120,
            )
            if not r.ok:
                return "{}"
            data = r.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content")
            return str(content) if isinstance(content, str) else "{}"
        except Exception:
            return "{}"

    def completion_stream(
        self,
        messages: List[Dict[str, Any]],
        params: Dict[str, Any],
    ) -> Generator[str, None, None]:
        try:
            payload = self._build_payload(messages, params, stream=True)
            with requests.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
                stream=True,
                timeout=300,
            ) as resp:
                if resp.status_code >= 400:
                    msg = resp.text[:500]
                    yield f"\n[Backend Error: openai HTTP {resp.status_code}: {msg}]"
                    return

                for raw in resp.iter_lines(decode_unicode=False):
                    if not raw:
                        continue
                    line = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
                    line = line.strip()
                    if not line.startswith("data:"):
                        continue
                    body = line[5:].strip()
                    if not body:
                        continue
                    if body == "[DONE]":
                        return
                    try:
                        obj = json.loads(body)
                    except Exception:
                        continue
                    if isinstance(obj, dict) and obj.get("error"):
                        msg = obj.get("error", {}).get("message") or str(obj.get("error"))
                        yield f"\n[Backend Error: {msg}]"
                        return
                    content = obj.get("choices", [{}])[0].get("delta", {}).get("content")
                    if isinstance(content, str) and content:
                        yield content
        except Exception as exc:
            logger.error("Generation Error (openai): %s", exc, exc_info=True)
            yield f"\n[Backend Error: {str(exc)}]"

    def list_models(self) -> List[Dict[str, Any]]:
        try:
            r = requests.get(
                f"{self._base_url}/models",
                headers=self._headers(),
                timeout=15,
            )
            if not r.ok:
                return []
            payload = r.json()
            items = payload.get("data") if isinstance(payload, dict) else []
            out: List[Dict[str, Any]] = []
            for item in items or []:
                out.append(
                    {
                        "name": str(item.get("id") or ""),
                        "size_str": str(item.get("owned_by") or "-"),
                        "quant": str(item.get("object") or "model"),
                    }
                )
            return out
        except Exception:
            return []

    def set_runtime_config(self, config: Dict[str, Any]) -> None:
        if config.get("base_url"):
            self._base_url = str(config["base_url"]).rstrip("/")
        if config.get("api_key") is not None:
            self._api_key = str(config["api_key"]).strip()
        if config.get("model"):
            self._default_model = str(config["model"]).strip()
            self._current_model = self._default_model
