from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Dict, List, Optional

import httpx

from ..models.schemas import ModelOption


def _env(*names: str, default: Optional[str] = None) -> Optional[str]:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return default


DEFAULT_BASE_URL = _env("LLM_BASE_URL", default="https://api.deepseek.com/chat/completions")
DEFAULT_API_KEY = _env("LLM_API_KEY", "OPENAI_API_KEY", "DEEPSEEK_API_KEY", "ZHIPU_API_KEY")
DEFAULT_MODEL_FAST = _env("LLM_MODEL_FAST", default="deepseek-chat")
DEFAULT_MODEL_SMART = _env("LLM_MODEL_SMART", default=DEFAULT_MODEL_FAST or "deepseek-chat")
LLM_TIMEOUT = float(_env("LLM_TIMEOUT", default="120") or "120")

DASHSCOPE_API_KEY = _env("DASHSCOPE_API_KEY")
DASHSCOPE_BASE_URL = _env("DASHSCOPE_BASE_URL", default="https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions")
DASHSCOPE_MODEL_TEXT = _env("DASHSCOPE_MODEL_TEXT", default="qwen-plus")
DASHSCOPE_MODEL_VISION = _env("DASHSCOPE_MODEL_VISION", default="qwen-vl-plus")

ARK_API_KEY = _env("ARK_API_KEY", "DOUBAO_API_KEY")
ARK_BASE_URL = _env("ARK_BASE_URL", default="https://ark.cn-beijing.volces.com/api/v3/chat/completions")
ARK_MODEL_TEXT = _env("ARK_MODEL_TEXT", default="doubao-1-5-pro-32k-250115")
ARK_MODEL_VISION = _env("ARK_MODEL_VISION", default="doubao-1-5-vision-pro-32k-250115")

ZHIPU_API_KEY = _env("ZHIPU_API_KEY")
ZHIPU_BASE_URL = _env("ZHIPU_BASE_URL", default="https://open.bigmodel.cn/api/coding/paas/v4")
ZHIPU_MODELS = _env("ZHIPU_MODELS", default="glm-5.1,glm-5,glm-5-turbo,glm-4.7")

DEEPSEEK_EXTRA_MODELS = _env("DEEPSEEK_EXTRA_MODELS", default="")


MODEL_DESCRIPTIONS = {
    "default": "平台默认文本模型，适合高质量课程问答与综合解释。",
    "default-fast": "平台快速模型，适合轻量问答与快速生成。",
    "gpt-smart": "GPT 高质量模型，适合课程概念解释、综合问答和结构化生成。",
    "gpt-fast": "GPT 快速模型，适合课堂即时问答、追问和轻量总结。",
    "glm-5.1": "GLM-5.1 高质量模型，适合课程概念解释、推理问答和结构化生成。",
    "glm-5": "GLM-5 通用模型，适合综合问答与内容生成。",
    "glm-5-turbo": "GLM-5-Turbo 快速模型，适合课堂即时问答和轻量总结。",
    "glm-4.7": "GLM-4.7 稳定模型，适合通用课程问答与内容创作。",
    "qwen-text": "千问文本模型，适合快速问答、文档总结与中文解释。",
    "qwen-vision": "千问视觉模型，适合图文理解、截图分析与多模态提问。",
    "doubao-text": "豆包文本模型，适合课堂概念讲解、内容生成与总结。",
    "doubao-vision": "豆包视觉模型，适合图片理解、截图问答和图文综合分析。",
}


FALLBACK_NOTES = {
    "model_unavailable": "当前所选模型暂不可用，已尝试切换到默认模型。",
    "provider_unavailable": "模型服务暂时不可用，请稍后重试或切换其他模型。",
    "provider_unconfigured": "当前环境尚未配置可用的大模型服务，请先配置 API Key 与模型参数。",
}


def _infer_default_provider() -> str:
    base_url = (DEFAULT_BASE_URL or "").lower()
    model_name = (DEFAULT_MODEL_SMART or DEFAULT_MODEL_FAST or "").lower()
    if "openai.com" in base_url or model_name.startswith("gpt") or model_name.startswith("o"):
        return "openai"
    if "bigmodel.cn" in base_url or "zhipu" in base_url or "glm" in model_name:
        return "zhipu"
    if "deepseek" in base_url or "deepseek" in model_name:
        return "deepseek"
    return "default"


def _format_model_label(model_name: str) -> str:
    normalized = (model_name or "").strip()
    lowered = normalized.lower()
    if lowered.startswith("gpt-"):
        pretty = normalized.replace("mini", "mini").replace("preview", "preview")
        pretty = pretty.replace("gpt-", "GPT-")
        pretty = pretty.replace("-mini", " mini")
        pretty = pretty.replace("-nano", " nano")
        return pretty
    if lowered.startswith("o1") or lowered.startswith("o3") or lowered.startswith("o4"):
        return normalized.upper().replace("-MINI", " mini")
    if lowered.startswith("deepseek"):
        return normalized.replace("deepseek", "DeepSeek")
    if lowered.startswith("glm"):
        return normalized.upper()
    return normalized or "默认模型"


def _build_default_model_entries() -> Dict[str, Dict[str, Any]]:
    if not DEFAULT_API_KEY:
        return {}
    provider = _infer_default_provider()
    smart_model = DEFAULT_MODEL_SMART or DEFAULT_MODEL_FAST or ""
    fast_model = DEFAULT_MODEL_FAST or DEFAULT_MODEL_SMART or ""
    items: Dict[str, Dict[str, Any]] = {}

    if provider == "openai":
        items["gpt-smart"] = {
            "label": _format_model_label(smart_model),
            "provider": "openai",
            "model_name": smart_model,
            "base_url": DEFAULT_BASE_URL,
            "api_key": DEFAULT_API_KEY,
            "supports_vision": False,
            "is_default": True,
            "description": MODEL_DESCRIPTIONS["gpt-smart"],
        }
        if fast_model and fast_model != smart_model:
            items["gpt-fast"] = {
                "label": _format_model_label(fast_model),
                "provider": "openai",
                "model_name": fast_model,
                "base_url": DEFAULT_BASE_URL,
                "api_key": DEFAULT_API_KEY,
                "supports_vision": False,
                "is_default": False,
                "description": MODEL_DESCRIPTIONS["gpt-fast"],
            }
        return items

    if provider == "zhipu":
        items["glm-smart"] = {
            "label": _format_model_label(smart_model),
            "provider": "zhipu",
            "model_name": smart_model,
            "base_url": DEFAULT_BASE_URL,
            "api_key": DEFAULT_API_KEY,
            "supports_vision": False,
            "is_default": True,
            "description": MODEL_DESCRIPTIONS["glm-smart"],
        }
        if fast_model and fast_model != smart_model:
            items["glm-fast"] = {
                "label": _format_model_label(fast_model),
                "provider": "zhipu",
                "model_name": fast_model,
                "base_url": DEFAULT_BASE_URL,
                "api_key": DEFAULT_API_KEY,
                "supports_vision": False,
                "is_default": False,
                "description": MODEL_DESCRIPTIONS["glm-fast"],
            }
        return items

    items["default"] = {
        "label": _format_model_label(smart_model),
        "provider": provider,
        "model_name": smart_model,
        "base_url": DEFAULT_BASE_URL,
        "api_key": DEFAULT_API_KEY,
        "supports_vision": False,
        "is_default": True,
        "description": MODEL_DESCRIPTIONS["default"],
    }
    if fast_model and fast_model != smart_model:
        items["default-fast"] = {
            "label": _format_model_label(fast_model),
            "provider": provider,
            "model_name": fast_model,
            "base_url": DEFAULT_BASE_URL,
            "api_key": DEFAULT_API_KEY,
            "supports_vision": False,
            "is_default": False,
            "description": MODEL_DESCRIPTIONS["default-fast"],
        }
    if DEEPSEEK_EXTRA_MODELS and provider == "deepseek":
        for model_name in DEEPSEEK_EXTRA_MODELS.split(","):
            model_name = model_name.strip()
            if not model_name or model_name in (smart_model, fast_model):
                continue
            key = model_name.lower().replace("_", "-")
            items[key] = {
                "label": _format_model_label(model_name),
                "provider": "deepseek",
                "model_name": model_name,
                "base_url": DEFAULT_BASE_URL,
                "api_key": DEFAULT_API_KEY,
                "supports_vision": False,
                "is_default": False,
                "description": f"DeepSeek {model_name}，适合课程问答与内容生成。",
            }
    return items


def _model_catalog() -> Dict[str, Dict[str, Any]]:
    catalog: Dict[str, Dict[str, Any]] = {}
    catalog.update(_build_default_model_entries())
    if DASHSCOPE_API_KEY:
        catalog["qwen-text"] = {
            "label": "千问文本模型",
            "provider": "qwen",
            "model_name": DASHSCOPE_MODEL_TEXT,
            "base_url": DASHSCOPE_BASE_URL,
            "api_key": DASHSCOPE_API_KEY,
            "supports_vision": False,
            "is_default": False,
            "description": MODEL_DESCRIPTIONS["qwen-text"],
        }
        catalog["qwen-vision"] = {
            "label": "千问视觉模型",
            "provider": "qwen",
            "model_name": DASHSCOPE_MODEL_VISION,
            "base_url": DASHSCOPE_BASE_URL,
            "api_key": DASHSCOPE_API_KEY,
            "supports_vision": True,
            "is_default": False,
            "description": MODEL_DESCRIPTIONS["qwen-vision"],
        }
    if ARK_API_KEY:
        catalog["doubao-text"] = {
            "label": "豆包文本模型",
            "provider": "doubao",
            "model_name": ARK_MODEL_TEXT,
            "base_url": ARK_BASE_URL,
            "api_key": ARK_API_KEY,
            "supports_vision": False,
            "is_default": False,
            "description": MODEL_DESCRIPTIONS["doubao-text"],
        }
        catalog["doubao-vision"] = {
            "label": "豆包视觉模型",
            "provider": "doubao",
            "model_name": ARK_MODEL_VISION,
            "base_url": ARK_BASE_URL,
            "api_key": ARK_API_KEY,
            "supports_vision": True,
            "is_default": False,
            "description": MODEL_DESCRIPTIONS["doubao-vision"],
        }
    if ZHIPU_API_KEY:
        for model_name in ZHIPU_MODELS.split(","):
            model_name = model_name.strip()
            if not model_name:
                continue
            key = model_name.lower().replace("_", "-")
            desc_key = key
            description = MODEL_DESCRIPTIONS.get(desc_key, f"GLM {model_name}，适合课程问答与内容生成。")
            catalog[f"zhipu-{key}"] = {
                "label": _format_model_label(model_name),
                "provider": "zhipu",
                "model_name": model_name,
                "base_url": ZHIPU_BASE_URL,
                "api_key": ZHIPU_API_KEY,
                "supports_vision": False,
                "is_default": False,
                "description": description,
            }
    return catalog


def list_available_models() -> List[ModelOption]:
    items: List[ModelOption] = []
    for key, value in _model_catalog().items():
        items.append(
            ModelOption(
                key=key,
                label=value["label"],
                provider=value["provider"],
                model_name=value["model_name"],
                supports_vision=bool(value.get("supports_vision")),
                is_default=bool(value.get("is_default")),
                description=value.get("description", ""),
                availability_note="已接入",
            )
        )
    return items


def _get_model_config(model_key: str | None) -> Optional[Dict[str, Any]]:
    catalog = _model_catalog()
    if model_key and model_key in catalog:
        return catalog[model_key]
    return catalog.get("default") or (next(iter(catalog.values())) if catalog else None)


def _get_http_client() -> httpx.Client:
    return httpx.Client(timeout=LLM_TIMEOUT, trust_env=True)


def _normalize_chat_endpoint(base_url: str) -> str:
    normalized = (base_url or "").strip().rstrip("/")
    if not normalized:
        return normalized
    if normalized.endswith("/chat/completions"):
        return normalized
    if normalized.endswith("/v1") or normalized.endswith("/v4"):
        return normalized + "/chat/completions"
    if "/api/coding/paas/v4" in normalized and not normalized.endswith("/chat/completions"):
        return normalized + "/chat/completions"
    return normalized


def _norm_compare_text(text: str) -> str:
    return re.sub(r"\s+", "", (text or "")).strip().lower()


def _dedupe_text_parts(parts: List[str]) -> List[str]:
    result: List[str] = []
    seen: List[str] = []
    for part in parts:
        clean = (part or "").strip()
        if not clean:
            continue
        norm = _norm_compare_text(clean)
        if not norm:
            continue
        duplicated = False
        for prev in seen:
            if norm == prev:
                duplicated = True
                break
            if min(len(norm), len(prev)) >= 120 and (norm in prev or prev in norm):
                duplicated = True
                break
        if duplicated:
            continue
        seen.append(norm)
        result.append(clean)
    return result


def _dedupe_answer_body(text: str) -> str:
    clean = (text or "").strip()
    if not clean:
        return ""

    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", clean) if part.strip()]
    if paragraphs:
        deduped = _dedupe_text_parts(paragraphs)
        if deduped:
            clean = "\n\n".join(deduped)

    blocks = [part.strip() for part in clean.split("\n\n") if part.strip()]
    if len(blocks) >= 2 and len(blocks) % 2 == 0:
        half = len(blocks) // 2
        first = "\n\n".join(blocks[:half]).strip()
        second = "\n\n".join(blocks[half:]).strip()
        if _norm_compare_text(first) and _norm_compare_text(first) == _norm_compare_text(second):
            clean = first

    norm = _norm_compare_text(clean)
    if len(norm) >= 160 and len(norm) % 2 == 0 and norm[: len(norm) // 2] == norm[len(norm) // 2 :]:
        clean = clean[: max(1, len(clean) // 2)].strip()

    clean = re.sub(r"\n{3,}", "\n\n", clean)
    return clean.strip()


def _call_chat_model(messages: List[Dict[str, Any]], *, model_key: str = "default", max_tokens: int = 2048, temperature: float = 0.4) -> Dict[str, Any]:
    catalog = _model_catalog()
    requested_key = model_key or "default"
    config = _get_model_config(requested_key)
    if not config:
        return {
            "success": False,
            "content": None,
            "error": FALLBACK_NOTES["provider_unconfigured"],
            "requested_model_key": requested_key,
            "used_model_key": "",
            "used_model_name": "",
            "provider": "",
            "duration_ms": 0,
            "fallback_used": False,
        }

    fallback_used = False
    fallback_note = ""
    if requested_key not in catalog and requested_key != config.get("provider"):
        fallback_used = requested_key != "default"
        if fallback_used:
            fallback_note = FALLBACK_NOTES["model_unavailable"]

    start = time.perf_counter()
    try:
        with _get_http_client() as client:
            response = client.post(
                _normalize_chat_endpoint(config["base_url"]),
                headers={
                    "Authorization": f"Bearer {config['api_key']}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": config["model_name"],
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
        response.raise_for_status()
        data = response.json()
        message = data.get("choices", [{}])[0].get("message", {})
        content = message.get("content", "")
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict):
                    parts.append(item.get("text") or item.get("content") or "")
                elif isinstance(item, str):
                    parts.append(item)
            content = "\n\n".join(_dedupe_text_parts(parts)).strip()
        else:
            content = str(content).strip() or None
        duration_ms = int((time.perf_counter() - start) * 1000)
        print(f"[LLM] requested={requested_key} used={config['model_name']} provider={config['provider']} ok=true fallback={fallback_used} duration_ms={duration_ms}")
        return {
            "success": bool(content),
            "content": content,
            "error": fallback_note,
            "requested_model_key": requested_key,
            "used_model_key": next((key for key, value in catalog.items() if value is config), requested_key),
            "used_model_name": config["model_name"],
            "provider": config["provider"],
            "duration_ms": duration_ms,
            "fallback_used": fallback_used,
        }
    except Exception as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        print(f"[LLM] requested={requested_key} provider={config['provider']} ok=false duration_ms={duration_ms} error={exc}")
        return {
            "success": False,
            "content": None,
            "error": str(exc) or FALLBACK_NOTES["provider_unavailable"],
            "requested_model_key": requested_key,
            "used_model_key": next((key for key, value in catalog.items() if value is config), requested_key),
            "used_model_name": config["model_name"],
            "provider": config["provider"],
            "duration_ms": duration_ms,
            "fallback_used": fallback_used,
        }


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(text)
    except Exception:
        pass
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fenced:
        try:
            return json.loads(fenced.group(1).strip())
        except Exception:
            pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            pass
    return None


def _truncate(text: str, limit: int = 2500) -> str:
    return text if len(text) <= limit else text[:limit] + "\n[内容已截断]"


def _clean_answer_text(raw_content: str) -> str:
    text = (raw_content or "").strip()
    if not text:
        return ""

    data = _extract_json(text)
    if isinstance(data, dict) and data.get("answer"):
        text = str(data.get("answer", "")).strip()
    else:
        fenced = re.search(r"```(?:json|text|markdown)?\s*([\s\S]*?)```", text)
        if fenced:
            text = fenced.group(1).strip()
            nested = _extract_json(text)
            if isinstance(nested, dict) and nested.get("answer"):
                text = str(nested.get("answer", "")).strip()

    text = re.sub(r'^\s*"answer"\s*:\s*', "", text, flags=re.IGNORECASE)
    text = text.strip().strip("{}").strip()
    text = text.replace("\\n", "\n").replace("/n", "\n").replace("\r\n", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return _dedupe_answer_body(text)
