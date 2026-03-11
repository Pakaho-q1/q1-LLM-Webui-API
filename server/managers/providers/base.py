from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Generator, List, Optional

from managers.providers.params import CANONICAL_CHAT_PARAMS, normalize_canonical_chat_params


class LLMProvider(ABC):
    """Provider-agnostic LLM contract used by API/application layers."""

    provider_name: str = "unknown"

    @property
    @abstractmethod
    def model_name(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def n_ctx(self) -> int:
        raise NotImplementedError

    @property
    @abstractmethod
    def multimodal_enabled(self) -> bool:
        raise NotImplementedError

    @property
    @abstractmethod
    def mmproj_path(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def chat_format(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def is_loaded(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def load_model(self, model_path: str, **params: Any) -> tuple[bool, str]:
        raise NotImplementedError

    @abstractmethod
    def unload_model(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def count_tokens(self, text: str) -> int:
        raise NotImplementedError

    @abstractmethod
    def generate_json(self, messages: List[Dict[str, Any]], params: Dict[str, Any]) -> str:
        raise NotImplementedError

    @abstractmethod
    def completion_stream(
        self,
        messages: List[Dict[str, Any]],
        params: Dict[str, Any],
    ) -> Generator[str, None, None]:
        raise NotImplementedError

    def list_models(self) -> List[Dict[str, Any]]:
        return []

    def supported_chat_params(self) -> List[str]:
        return []

    def unsupported_chat_params(self, params: Dict[str, Any]) -> List[str]:
        return []

    def invalid_chat_params(self, params: Dict[str, Any]) -> List[str]:
        _, invalid = normalize_canonical_chat_params(params or {})
        return sorted(set(invalid))

    def unknown_chat_params(self, params: Dict[str, Any]) -> List[str]:
        unknown: List[str] = []
        for key in (params or {}).keys():
            key_s = str(key)
            if key_s.startswith("_"):
                continue
            if key_s not in CANONICAL_CHAT_PARAMS and key_s != "parameters":
                unknown.append(key_s)
        return sorted(set(unknown))

    def supports_local_model_lifecycle(self) -> bool:
        return False

    def supports_model_downloads(self) -> bool:
        return False

    def effective_model(self, fallback: Optional[str] = None) -> str:
        return self.model_name or (fallback or "local-model")
