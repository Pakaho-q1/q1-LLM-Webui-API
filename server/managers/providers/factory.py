from __future__ import annotations

import os
from typing import Any, Dict, Tuple

from managers.llm_core import LLMEngine
from managers.providers.base import LLMProvider
from managers.providers.local_provider import LocalLLMProvider
from managers.providers.openai_provider import OpenAIProvider
from managers.providers.ollama_provider import OllamaProvider


def create_provider_by_name(
    provider_name: str,
    config: Dict[str, Any] | None = None,
) -> Tuple[LLMProvider, LLMEngine | None]:
    normalized = (provider_name or "local").strip().lower()

    if normalized == "ollama":
        return OllamaProvider(config=config), None

    if normalized == "openai":
        return OpenAIProvider(config=config), None

    engine = LLMEngine()
    return LocalLLMProvider(engine), engine


def create_llm_provider() -> Tuple[LLMProvider, LLMEngine | None]:
    provider_name = (os.environ.get("LLM_PROVIDER") or "local").strip().lower()
    return create_provider_by_name(provider_name)
