from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Generator, List

import requests

from managers.providers.base import LLMProvider
from managers.providers.params import CANONICAL_CHAT_PARAMS, normalize_canonical_chat_params

logger = logging.getLogger(__name__)


class OllamaProvider(LLMProvider):
    provider_name = "ollama"

    def __init__(self, config: Dict[str, Any] | None = None) -> None:
        cfg = dict(config or {})
        self._base_url = str(cfg.get("base_url") or os.environ.get("OLLAMA_BASE_URL") or "http://127.0.0.1:11434").rstrip("/")
        self._default_model = str(cfg.get("model") or os.environ.get("OLLAMA_MODEL") or "").strip()
        self._current_model = self._default_model
        self._multimodal_enabled = (
            str(cfg.get("multimodal_enabled") or os.environ.get("OLLAMA_MULTIMODAL_ENABLED", "true")).strip().lower()
            in {"1", "true", "yes", "on"}
        )
        self._n_ctx = int(cfg.get("n_ctx") or os.environ.get("OLLAMA_N_CTX", "8192"))

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
        return "ollama-chat"

    def is_loaded(self) -> bool:
        # Ollama is remote-service based. If service is reachable, provider is usable.
        try:
            r = requests.get(f"{self._base_url}/api/tags", timeout=5)
            return r.ok
        except Exception:
            return False

    def load_model(self, model_path: str, **params: Any) -> tuple[bool, str]:
        # External provider does not "load" local model files; choose active model name.
        model = str(params.get("model") or model_path or "").strip()
        if not model:
            return False, "model is required for Ollama provider"
        self._current_model = model
        return True, f"Ollama active model set to: {model}"

    def unload_model(self) -> None:
        # No-op for external provider.
        self._current_model = self._default_model

    def count_tokens(self, text: str) -> int:
        # Conservative fallback estimation, provider-independent.
        return max(1, len((text or "")) // 3)

    def _extract_text_from_content(self, content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            texts: List[str] = []
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text" and isinstance(part.get("text"), str):
                    texts.append(part["text"])
            return "\n".join(t for t in texts if t.strip())
        return ""

    def _to_ollama_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        out: List[Dict[str, str]] = []
        for message in messages:
            out.append(
                {
                    "role": str(message.get("role") or "user"),
                    "content": self._extract_text_from_content(message.get("content")),
                }
            )
        return out

    def _resolve_model(self, params: Dict[str, Any]) -> str:
        candidate = str(params.get("model") or self._current_model or self._default_model or "").strip()
        available = self._fetch_model_names()
        if not candidate:
            if not available:
                raise ValueError("No model selected for Ollama provider. Set OLLAMA_MODEL or pass model in request.")
            candidate = available[0]
            logger.warning("No Ollama model selected; auto-selected first available model: %s", candidate)
        elif available and candidate not in available:
            raise ValueError(
                f"Ollama model '{candidate}' not found. Available models: {', '.join(available[:10])}"
            )
        self._current_model = candidate
        return candidate

    def _fetch_model_names(self) -> List[str]:
        try:
            r = requests.get(f"{self._base_url}/api/tags", timeout=8)
            if not r.ok:
                return []
            data = r.json()
            models = data.get("models") if isinstance(data, dict) else []
            names: List[str] = []
            for item in models or []:
                name = str(item.get("name") or "").strip()
                if name:
                    names.append(name)
            return names
        except Exception:
            return []

    def supported_chat_params(self) -> List[str]:
        return [
            "model",
            "temperature",
            "top_p",
            "max_tokens",
            "stop",
            "top_k",
            "min_p",
            "repeat_penalty",
            "seed",
            "mirostat_mode",
            "mirostat_tau",
            "mirostat_eta",
            "n_ctx",
        ]

    def unsupported_chat_params(self, params: Dict[str, Any]) -> List[str]:
        supported = set(self.supported_chat_params())
        unsupported: List[str] = []
        for key in (params or {}).keys():
            key_s = str(key)
            if key_s.startswith("_"):
                continue
            if key_s in {"parameters"}:
                continue
            if key_s in CANONICAL_CHAT_PARAMS and key_s not in supported:
                unsupported.append(key_s)
            elif key_s not in CANONICAL_CHAT_PARAMS:
                unsupported.append(key_s)
        return sorted(set(unsupported))

    def _build_ollama_options(self, params: Dict[str, Any]) -> tuple[Dict[str, Any], List[str], List[str]]:
        canonical, validation_errors = normalize_canonical_chat_params(params)
        unsupported = self.unsupported_chat_params(canonical)
        options: Dict[str, Any] = {}

        map_float = {
            "temperature": "temperature",
            "top_p": "top_p",
            "min_p": "min_p",
            "repeat_penalty": "repeat_penalty",
            "mirostat_tau": "mirostat_tau",
            "mirostat_eta": "mirostat_eta",
        }
        map_int = {
            "max_tokens": "num_predict",
            "top_k": "top_k",
            "seed": "seed",
            "mirostat_mode": "mirostat",
            "n_ctx": "num_ctx",
        }

        for source_key, target_key in map_float.items():
            if canonical.get(source_key) is not None:
                options[target_key] = float(canonical[source_key])
        for source_key, target_key in map_int.items():
            if canonical.get(source_key) is not None:
                options[target_key] = int(canonical[source_key])

        if canonical.get("stop"):
            options["stop"] = list(canonical["stop"])

        warnings: List[str] = []
        if unsupported:
            warnings.append(f"unsupported_params={','.join(unsupported)}")
        if validation_errors:
            warnings.append(f"invalid_param_values={','.join(sorted(set(validation_errors)))}")

        return options, unsupported, warnings

    def generate_json(self, messages: List[Dict[str, Any]], params: Dict[str, Any]) -> str:
        try:
            model = self._resolve_model(params)
            options, _, warnings = self._build_ollama_options(params)
            if warnings:
                logger.warning("Ollama param mapping warnings: %s", "; ".join(warnings))
            payload = {
                "model": model,
                "messages": self._to_ollama_messages(messages),
                "stream": False,
                "format": "json",
                "options": options or {"temperature": 0.0, "num_predict": int(params.get("max_tokens", 1024))},
            }
            r = requests.post(f"{self._base_url}/api/chat", json=payload, timeout=120)
            if not r.ok:
                return "{}"
            data = r.json()
            message = data.get("message") or {}
            content = message.get("content")
            return str(content) if isinstance(content, str) else "{}"
        except Exception:
            return "{}"

    def completion_stream(
        self,
        messages: List[Dict[str, Any]],
        params: Dict[str, Any],
    ) -> Generator[str, None, None]:
        try:
            model = self._resolve_model(params)
            options, _, warnings = self._build_ollama_options(params)
            if warnings:
                logger.warning("Ollama param mapping warnings: %s", "; ".join(warnings))
            payload = {
                "model": model,
                "messages": self._to_ollama_messages(messages),
                "stream": True,
                "options": options
                or {
                    "temperature": float(params.get("temperature", 0.7)),
                    "top_p": float(params.get("top_p", 0.95)),
                    "num_predict": int(params.get("max_tokens", 512)),
                },
            }

            with requests.post(
                f"{self._base_url}/api/chat",
                json=payload,
                stream=True,
                timeout=300,
            ) as resp:
                if resp.status_code >= 400:
                    msg = resp.text[:500]
                    yield f"\n[Backend Error: ollama HTTP {resp.status_code}: {msg}]"
                    return

                for raw in resp.iter_lines(decode_unicode=False):
                    if not raw:
                        continue
                    line = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
                    try:
                        obj = json.loads(line)
                    except Exception:
                        continue

                    message = obj.get("message") or {}
                    content = message.get("content")
                    if isinstance(content, str) and content:
                        yield content
                    if obj.get("done"):
                        return
        except Exception as exc:
            logger.error("Generation Error (ollama): %s", exc, exc_info=True)
            yield f"\n[Backend Error: {str(exc)}]"

    def list_models(self) -> List[Dict[str, Any]]:
        try:
            r = requests.get(f"{self._base_url}/api/tags", timeout=10)
            if not r.ok:
                return []
            data = r.json()
            models = data.get("models") if isinstance(data, dict) else []
            out: List[Dict[str, Any]] = []
            for item in models or []:
                name = str(item.get("name") or "")
                size = int(item.get("size") or 0)
                out.append(
                    {
                        "name": name,
                        "size_str": f"{round(size / (1024 * 1024 * 1024), 2)} GB" if size > 0 else "-",
                        "quant": str(item.get("details", {}).get("quantization_level") or "-"),
                    }
                )
            return out
        except Exception:
            return []

    def set_runtime_config(self, config: Dict[str, Any]) -> None:
        if config.get("base_url"):
            self._base_url = str(config["base_url"]).rstrip("/")
        if config.get("model"):
            model = str(config["model"]).strip()
            self._default_model = model
            self._current_model = model
        if config.get("n_ctx") is not None:
            self._n_ctx = int(config["n_ctx"])
        if config.get("multimodal_enabled") is not None:
            self._multimodal_enabled = (
                str(config["multimodal_enabled"]).strip().lower() in {"1", "true", "yes", "on"}
            )
