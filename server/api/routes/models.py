import asyncio
import ipaddress
import os
from urllib.parse import urlsplit
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from api.dependencies import verify_api_key
from api.runtime import app_state
from managers.providers.local_provider import LocalLLMProvider
from managers.providers.openai_provider import OpenAIProvider
from managers.providers.ollama_provider import OllamaProvider
from managers.providers.params import CANONICAL_CHAT_PARAMS

router = APIRouter(dependencies=[Depends(verify_api_key)])
DEFAULT_DOWNLOAD_ALLOWED_HOSTS = ("huggingface.co", "cdn-lfs.huggingface.co")


class LoadModelRequest(BaseModel):
    model_path: str
    params: Dict[str, Any] = Field(default_factory=dict)


class DownloadModelRequest(BaseModel):
    url: str


class CancelDownloadRequest(BaseModel):
    job_id: str


class ProviderUpdateRequest(BaseModel):
    provider: str
    config: Dict[str, Any] = Field(default_factory=dict)


def _parse_allowed_download_hosts() -> List[str]:
    raw = (os.environ.get("MODEL_DOWNLOAD_ALLOWED_HOSTS") or "").strip()
    if not raw:
        return list(DEFAULT_DOWNLOAD_ALLOWED_HOSTS)
    hosts = [h.strip().lower() for h in raw.split(",") if h.strip()]
    return hosts or list(DEFAULT_DOWNLOAD_ALLOWED_HOSTS)


def _is_blocked_ip(hostname: str) -> bool:
    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        return False
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _is_host_allowed(hostname: str, allowed_hosts: List[str]) -> bool:
    host = (hostname or "").strip().lower().rstrip(".")
    if not host:
        return False
    if _is_blocked_ip(host):
        return False
    return any(host == allowed or host.endswith(f".{allowed}") for allowed in allowed_hosts)


def _validate_model_download_url(url: str) -> str:
    parsed = urlsplit((url or "").strip())
    if parsed.scheme not in {"https"}:
        raise HTTPException(status_code=400, detail="Download URL must use https")

    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid download URL")

    allowed_hosts = _parse_allowed_download_hosts()
    if not _is_host_allowed(parsed.hostname, allowed_hosts):
        raise HTTPException(
            status_code=400,
            detail=f"Download host is not allowed. Allowed hosts: {', '.join(allowed_hosts)}",
        )

    return parsed.geturl()


def _provider_feature_map() -> Dict[str, Dict[str, bool]]:
    return {
        "local": {
            "local_model_lifecycle": True,
            "model_downloads": True,
            "multimodal": True,
        },
        "ollama": {
            "local_model_lifecycle": False,
            "model_downloads": False,
            "multimodal": True,
        },
        "openai": {
            "local_model_lifecycle": False,
            "model_downloads": False,
            "multimodal": True,
        },
    }


def _provider_config_schema() -> Dict[str, Any]:
    return {
        "local": {
            "fields": [],
            "description": "Uses local llama.cpp runtime and local model lifecycle.",
        },
        "ollama": {
            "fields": [
                {"key": "base_url", "type": "string", "required": False, "default": "http://127.0.0.1:11434"},
                {"key": "model", "type": "string", "required": False},
            ],
            "description": "Uses external Ollama server.",
        },
        "openai": {
            "fields": [
                {"key": "base_url", "type": "string", "required": False, "default": "https://api.openai.com/v1"},
                {"key": "api_key", "type": "secret", "required": True},
                {"key": "model", "type": "string", "required": False, "default": "gpt-4o-mini"},
            ],
            "description": "Uses OpenAI-compatible external API.",
        },
    }


def _masked_provider_config(config: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(config or {})
    if "api_key" in out:
        out["api_key"] = "***"
        out["has_api_key"] = bool(config.get("api_key"))
    return out


@router.get("/api/models")
async def list_models():
    loop = asyncio.get_running_loop()
    if app_state.llm_provider.supports_local_model_lifecycle():
        models = await loop.run_in_executor(
            app_state.executor,
            app_state.model_manager.list_models,
        )
    else:
        models = await loop.run_in_executor(
            app_state.executor,
            app_state.llm_provider.list_models,
        )
    return {"data": models or []}


@router.get("/api/provider/current")
async def get_current_provider():
    provider = app_state.llm_provider
    features = _provider_feature_map().get(provider.provider_name, {})
    return {
        "provider": provider.provider_name,
        "model": provider.model_name or "",
        "supported_chat_params": provider.supported_chat_params(),
        "features": {
            **features,
            "multimodal": bool(provider.multimodal_enabled),
        },
        "config": _masked_provider_config(app_state.provider_runtime_config),
        "config_schema": _provider_config_schema(),
    }


@router.put("/api/provider/current")
async def set_current_provider(payload: ProviderUpdateRequest, request: Request):
    provider_name = (payload.provider or "").strip().lower()
    if provider_name not in {"local", "ollama", "openai"}:
        raise HTTPException(status_code=400, detail="provider must be one of: local, ollama, openai")

    config = dict(payload.config or {})
    result = await app_state.switch_provider(provider_name, config=config)

    await app_state.broadcast_sse_message(
        {
            "type": "model_status",
            "data": {
                "running": bool(app_state.llm_provider.is_loaded()),
                "loading": False,
                "name": app_state.llm_provider.model_name or "",
                "model": app_state.llm_provider.model_name or "",
                "provider": app_state.llm_provider.provider_name,
                "request_id": getattr(request.state, "request_id", None),
            },
        }
    )

    features = _provider_feature_map().get(app_state.llm_provider.provider_name, {})
    return {
        "status": "ok",
        "data": {
            **result,
            "features": {
                **features,
                "multimodal": bool(app_state.llm_provider.multimodal_enabled),
            },
            "config": _masked_provider_config(app_state.provider_runtime_config),
        },
    }


@router.post("/api/models/load")
async def load_model(payload: LoadModelRequest, request: Request):
    model_name = payload.model_path
    if not model_name:
        raise HTTPException(status_code=400, detail="model_path is required")

    if not app_state.llm_provider.supports_local_model_lifecycle():
        loop = asyncio.get_running_loop()
        success, message = await loop.run_in_executor(
            app_state.executor,
            lambda: app_state.llm_provider.load_model(model_name, model=model_name, **(payload.params or {})),
        )
        if not success:
            raise HTTPException(status_code=500, detail=message)

        await app_state.broadcast_sse_message(
            {
                "type": "model_status",
                "data": {
                    "running": True,
                    "loading": False,
                    "name": app_state.llm_provider.model_name or model_name,
                    "model": app_state.llm_provider.model_name or model_name,
                    "request_id": getattr(request.state, "request_id", None),
                },
            }
        )
        return {
            "status": "ok",
            "data": {
                "name": app_state.llm_provider.model_name or model_name,
                "vision_enabled": bool(app_state.llm_provider.multimodal_enabled),
                "mmproj": app_state.llm_provider.mmproj_path or "",
                "mmproj_score": 0,
                "mmproj_reason": "external-provider",
            },
        }

    safe_model_path = app_state.model_manager.resolve_model_path(model_name)
    if safe_model_path is None:
        raise HTTPException(status_code=400, detail="invalid model_path")

    load_plan = app_state.model_manager.build_load_plan(model_name, payload.params or {})

    loop = asyncio.get_running_loop()
    success, message = await loop.run_in_executor(
        app_state.executor,
        lambda: app_state.llm_provider.load_model(
            str(safe_model_path), **(load_plan.get("params") or {})
        ),
    )
    if not success:
        raise HTTPException(status_code=500, detail=message)

    await app_state.broadcast_sse_message(
        {
            "type": "model_status",
            "data": {
                "running": True,
                "loading": False,
                "name": model_name,
                "model": model_name,
                "request_id": getattr(request.state, "request_id", None),
            },
        }
    )

    return {
        "status": "ok",
        "data": {
            "name": model_name,
            "vision_enabled": bool(load_plan.get("vision_enabled")),
            "mmproj": load_plan.get("mmproj"),
            "mmproj_score": load_plan.get("mmproj_score"),
            "mmproj_reason": load_plan.get("mmproj_reason"),
        },
    }


@router.post("/api/models/unload")
async def unload_model(request: Request):
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(app_state.executor, app_state.llm_provider.unload_model)
    await app_state.broadcast_sse_message(
        {
            "type": "model_status",
            "data": {
                "running": False,
                "loading": False,
                "name": "",
                "model": "",
                "request_id": getattr(request.state, "request_id", None),
            },
        }
    )
    return {"status": "ok"}


@router.delete("/api/models/{filename}")
async def delete_model(filename: str):
    if not app_state.llm_provider.supports_local_model_lifecycle():
        raise HTTPException(status_code=400, detail="Delete is not supported by external provider")

    loop = asyncio.get_running_loop()
    success = await loop.run_in_executor(
        app_state.executor,
        app_state.model_manager.delete_model,
        filename,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Failed to delete model")
    return {"status": "ok", "data": {"filename": filename}}


@router.get("/api/models/hf")
async def fetch_hf(repo: str):
    if not app_state.llm_provider.supports_local_model_lifecycle():
        raise HTTPException(status_code=400, detail="HF listing is only available for local provider")

    if not repo:
        raise HTTPException(status_code=400, detail="repo is required")
    loop = asyncio.get_running_loop()
    files = await loop.run_in_executor(
        app_state.executor,
        app_state.model_manager.fetch_hf_repo,
        repo,
    )
    return {"data": files or []}


@router.post("/api/models/downloads")
async def download_model(payload: DownloadModelRequest):
    if not app_state.llm_provider.supports_model_downloads():
        raise HTTPException(status_code=400, detail="Downloads are not supported by external provider")

    if not payload.url:
        raise HTTPException(status_code=400, detail="url is required")
    safe_url = _validate_model_download_url(payload.url)
    loop = asyncio.get_running_loop()
    job_id = await loop.run_in_executor(
        app_state.executor,
        app_state.model_manager.download_async,
        safe_url,
    )
    return {"status": "ok", "data": {"job_id": job_id}}


@router.get("/api/models/downloads")
async def download_status():
    if not app_state.llm_provider.supports_model_downloads():
        return {"data": []}

    loop = asyncio.get_running_loop()
    jobs = await loop.run_in_executor(
        app_state.executor,
        app_state.model_manager.download_manager.get_jobs,
    )
    jobs_list: List[Dict[str, Any]] = [
        {
            "id": job.get("id"),
            "filename": job.get("filename"),
            "progress": job.get("progress"),
            "speed": job.get("speed"),
            "eta": job.get("eta"),
            "status": job.get("status"),
            "error": job.get("error"),
        }
        for job in jobs
    ]
    return {"data": jobs_list}


@router.post("/api/models/downloads/cancel")
async def cancel_download(payload: CancelDownloadRequest):
    if not app_state.llm_provider.supports_model_downloads():
        raise HTTPException(status_code=400, detail="Downloads are not supported by external provider")

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        app_state.executor,
        app_state.model_manager.download_manager.cancel,
        payload.job_id,
    )
    return {"status": "ok"}


@router.get("/api/models/status")
async def model_status():
    running = bool(app_state.llm_provider.is_loaded())
    name = app_state.llm_provider.model_name or ""
    return {
        "running": running,
        "loading": False,
        "name": name,
        "model": name,
        "vision_enabled": bool(app_state.llm_provider.multimodal_enabled),
        "mmproj": app_state.llm_provider.mmproj_path or "",
        "chat_format": app_state.llm_provider.chat_format or "",
        "provider": app_state.llm_provider.provider_name,
        "supported_chat_params": app_state.llm_provider.supported_chat_params(),
    }


class CountTokensRequest(BaseModel):
    text: str


@router.post("/api/tokens/count")
async def count_tokens(payload: CountTokensRequest):
    loop = asyncio.get_running_loop()
    count = await loop.run_in_executor(
        app_state.executor,
        app_state.llm_provider.count_tokens,
        payload.text or "",
    )
    return {"data": count}


@router.get("/api/providers/capabilities")
async def provider_capabilities():
    current = app_state.llm_provider

    local_params = list(CANONICAL_CHAT_PARAMS)
    ollama_params = OllamaProvider().supported_chat_params()
    openai_params = OpenAIProvider(config={}).supported_chat_params()
    features = _provider_feature_map()

    providers = {
        "local": {
            "provider": LocalLLMProvider.provider_name,
            "supported_chat_params": local_params,
            "features": features["local"],
        },
        "ollama": {
            "provider": "ollama",
            "supported_chat_params": ollama_params,
            "features": features["ollama"],
        },
        "openai": {
            "provider": "openai",
            "supported_chat_params": openai_params,
            "features": features["openai"],
        },
    }

    return {
        "current_provider": current.provider_name,
        "current": {
            "provider": current.provider_name,
            "supported_chat_params": current.supported_chat_params(),
            "features": {
                **features.get(current.provider_name, {}),
                "multimodal": bool(current.multimodal_enabled),
            },
        },
        "canonical_chat_params": list(CANONICAL_CHAT_PARAMS),
        "providers": providers,
        "config_schema": _provider_config_schema(),
    }
