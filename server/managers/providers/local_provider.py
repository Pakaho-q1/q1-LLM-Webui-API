from __future__ import annotations

from typing import Any, Dict, Generator, List

from managers.llm_core import LLMEngine
from managers.providers.base import LLMProvider
from managers.providers.params import CANONICAL_CHAT_PARAMS


class LocalLLMProvider(LLMProvider):
    provider_name = "local"

    def __init__(self, engine: LLMEngine) -> None:
        self._engine = engine

    @property
    def model_name(self) -> str:
        return self._engine.model_name

    @property
    def n_ctx(self) -> int:
        return self._engine.n_ctx

    @property
    def multimodal_enabled(self) -> bool:
        return self._engine.multimodal_enabled

    @property
    def mmproj_path(self) -> str:
        return self._engine.mmproj_path

    @property
    def chat_format(self) -> str:
        return self._engine.chat_format

    def is_loaded(self) -> bool:
        return self._engine.is_loaded()

    def load_model(self, model_path: str, **params: Any) -> tuple[bool, str]:
        return self._engine.load_model(model_path, **params)

    def unload_model(self) -> None:
        self._engine.unload_model()

    def count_tokens(self, text: str) -> int:
        return self._engine.count_tokens(text)

    def generate_json(self, messages: List[Dict[str, Any]], params: Dict[str, Any]) -> str:
        return self._engine.generate_json(messages, params)

    def completion_stream(
        self,
        messages: List[Dict[str, Any]],
        params: Dict[str, Any],
    ) -> Generator[str, None, None]:
        return self._engine.completion_stream(messages, params)

    def supported_chat_params(self) -> List[str]:
        return list(CANONICAL_CHAT_PARAMS)

    def unsupported_chat_params(self, params: Dict[str, Any]) -> List[str]:
        unknown: List[str] = []
        for key in (params or {}).keys():
            if str(key).startswith("_"):
                continue
            if key not in CANONICAL_CHAT_PARAMS and key != "parameters":
                unknown.append(str(key))
        return sorted(set(unknown))

    def supports_local_model_lifecycle(self) -> bool:
        return True

    def supports_model_downloads(self) -> bool:
        return True
