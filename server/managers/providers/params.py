from __future__ import annotations

from typing import Any, Dict, List, Tuple


CANONICAL_CHAT_PARAMS: List[str] = [
    "model",
    "temperature",
    "top_p",
    "max_tokens",
    "stop",
    "top_k",
    "min_p",
    "typical_p",
    "repeat_penalty",
    "presence_penalty",
    "frequency_penalty",
    "seed",
    "mirostat_mode",
    "mirostat_tau",
    "mirostat_eta",
    "n_ctx",
]


def _as_float(value: Any) -> float | None:
    try:
        return float(value)
    except Exception:
        return None


def _as_int(value: Any) -> int | None:
    try:
        return int(value)
    except Exception:
        return None


def normalize_canonical_chat_params(params: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    normalized: Dict[str, Any] = {}
    errors: List[str] = []
    source = dict(params or {})

    if source.get("model") is not None:
        normalized["model"] = str(source.get("model")).strip()

    if source.get("temperature") is not None:
        v = _as_float(source.get("temperature"))
        if v is None:
            errors.append("temperature")
        else:
            normalized["temperature"] = max(0.0, min(v, 2.0))

    if source.get("top_p") is not None:
        v = _as_float(source.get("top_p"))
        if v is None:
            errors.append("top_p")
        else:
            normalized["top_p"] = max(0.0, min(v, 1.0))

    if source.get("max_tokens") is not None:
        v = _as_int(source.get("max_tokens"))
        if v is None or v < 1:
            errors.append("max_tokens")
        else:
            normalized["max_tokens"] = v

    if source.get("stop") is not None:
        stop = source.get("stop")
        if isinstance(stop, str):
            normalized["stop"] = [stop]
        elif isinstance(stop, list):
            normalized["stop"] = [str(s) for s in stop if isinstance(s, (str, int, float)) and str(s).strip()]
        else:
            errors.append("stop")

    for float_key in ["min_p", "typical_p", "repeat_penalty", "presence_penalty", "frequency_penalty", "mirostat_tau", "mirostat_eta"]:
        if source.get(float_key) is not None:
            v = _as_float(source.get(float_key))
            if v is None:
                errors.append(float_key)
            else:
                normalized[float_key] = v

    for int_key in ["top_k", "seed", "mirostat_mode", "n_ctx"]:
        if source.get(int_key) is not None:
            v = _as_int(source.get(int_key))
            if v is None:
                errors.append(int_key)
            else:
                normalized[int_key] = v

    return normalized, errors
