from __future__ import annotations

import base64
import json
import os
import re
import time
import uuid
import zipfile
from typing import Any, Dict, List, Optional
from xml.etree import ElementTree as ET

import httpx

from ..models.schemas import AnalyticsReport, AssignmentReviewRequest, AssignmentReviewResponse, Course, LessonPack, MaterialUpdateResult, ModelOption

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None


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


MODEL_DESCRIPTIONS = {
    "default": "平台默认文本模型，适合高质量课程问答与综合解释。",
    "gpt-smart": "GPT 高质量模型，适合课程概念解释、综合问答和结构化生成。",
    "gpt-fast": "GPT 快速模型，适合课堂即时问答、追问和轻量总结。",
    "glm-smart": "GLM 高质量模型，适合课程概念解释、推理问答和结构化生成。",
    "glm-fast": "GLM 快速模型，适合课堂即时问答、连续追问和轻量总结。",
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
            "description": "平台快速模型，适合轻量问答与快速生成。",
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

    # Remove repeated paragraphs caused by provider side duplicated chunks.
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", clean) if part.strip()]
    if paragraphs:
        deduped = _dedupe_text_parts(paragraphs)
        if deduped:
            clean = "\n\n".join(deduped)

    # Handle "same full answer + same full answer" concatenation.
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


def _strip_xml_text(xml_bytes: bytes) -> str:
    try:
        root = ET.fromstring(xml_bytes)
    except Exception:
        return ""
    texts: List[str] = []
    for elem in root.iter():
        if elem.text and elem.text.strip():
            texts.append(elem.text.strip())
    return " ".join(texts)


def extract_text_from_file(file_path: str, file_type: str) -> tuple[str, str]:
    file_type = (file_type or "").lower()
    try:
        if file_type == ".pdf":
            if PdfReader is None:
                return "当前环境尚未安装 pypdf，PDF 已保存但无法提取文本。", "stored"
            reader = PdfReader(file_path)
            pages: List[str] = []
            for page in reader.pages[:80]:
                text = (page.extract_text() or "").strip()
                if text:
                    pages.append(text)
            merged = "\n".join(pages).strip()
            if merged:
                return merged[:12000], "parsed"
            return "PDF 已保存，但未提取到可用文本（可能为扫描件或图片型 PDF）。", "stored"
        if file_type in {".txt", ".md", ".csv", ".json"}:
            raw = open(file_path, "rb").read()
            for encoding in ["utf-8", "gbk", "utf-8-sig"]:
                try:
                    return raw.decode(encoding), "parsed"
                except Exception:
                    continue
            return raw.decode("utf-8", errors="replace"), "parsed"
        if file_type == ".docx":
            with zipfile.ZipFile(file_path) as zf:
                xml_bytes = zf.read("word/document.xml")
            text = _strip_xml_text(xml_bytes)
            return text[:12000], "parsed" if text else "unsupported"
        if file_type == ".pptx":
            texts: List[str] = []
            with zipfile.ZipFile(file_path) as zf:
                for name in sorted(zf.namelist()):
                    if name.startswith("ppt/slides/slide") and name.endswith(".xml"):
                        texts.append(_strip_xml_text(zf.read(name)))
            merged = "\n".join([text for text in texts if text])
            return merged[:12000], "parsed" if merged else "unsupported"
        if file_type == ".zip":
            with zipfile.ZipFile(file_path) as zf:
                file_names = [name for name in zf.namelist() if not name.endswith("/")][:50]
            return "压缩包内容列表：" + "；".join(file_names), "indexed"
        if file_type in {".jpg", ".jpeg", ".png", ".webp"}:
            return "图片已保存；若所选模型支持视觉理解，系统会尝试结合图片分析。", "image"
        if file_type in {".doc", ".ppt", ".rar"}:
            return f"当前版本已保存该文件，但暂未深度解析 {file_type} 内容。", "stored"
    except Exception as exc:
        return f"文件解析失败：{exc}", "failed"
    return f"当前版本已保存该文件，但暂未支持解析 {file_type or '该类型'} 内容。", "stored"


def build_data_url(file_path: str, file_type: str) -> Optional[str]:
    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }
    mime = mime_map.get(file_type.lower())
    if not mime:
        return None
    try:
        raw = open(file_path, "rb").read()
        encoded = base64.b64encode(raw).decode("utf-8")
        return f"data:{mime};base64,{encoded}"
    except Exception:
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


def ask_course_assistant(
    *,
    question: str,
    course_name: str,
    course_context: str,
    history: List[Dict[str, str]],
    attachment_contexts: List[Dict[str, Any]],
    retrieved_chunks: Optional[List[Dict[str, Any]]] = None,
    model_key: str = "default",
    language: str = "zh-CN",
) -> Dict[str, Any]:
    attachment_texts = []
    source_labels: List[str] = []
    source_label_seen: set[str] = set()
    retrieval_sections: List[str] = []
    image_urls: List[str] = []
    model_config = _get_model_config(model_key)
    supports_vision = bool(model_config and model_config.get("supports_vision"))
    retrieval_source_hits: Dict[str, Dict[str, Any]] = {}

    def add_source_label(label: str) -> None:
        clean = (label or "").strip()
        if not clean or clean in source_label_seen:
            return
        source_label_seen.add(clean)
        source_labels.append(clean)

    for idx, item in enumerate((retrieved_chunks or [])[:8], start=1):
        snippet = str(item.get("snippet") or item.get("chunk_text") or "").strip()
        if not snippet:
            continue
        source_type = "课程包" if item.get("source_type") == "lesson_pack" else "教学资料"
        source_name = str(item.get("source_name") or source_type)
        tag = f"R{idx}"
        retrieval_sections.append(f"[{tag}] 来源：{source_name}（{source_type}）\n{snippet}")
        source_key = f"{item.get('source_type', '')}:{item.get('source_id', '')}:{source_name}"
        source_hit = retrieval_source_hits.get(source_key)
        if not source_hit:
            source_hit = {"source_name": source_name, "source_type": source_type, "tags": []}
            retrieval_source_hits[source_key] = source_hit
        source_hit["tags"].append(tag)

    for source_hit in retrieval_source_hits.values():
        tags = "/".join(source_hit["tags"][:4])
        add_source_label(f"检索命中[{tags}] {source_hit['source_name']}（{source_hit['source_type']}）")

    for item in attachment_contexts:
        summary = item.get("parse_summary", "")
        file_name = item.get("file_name", "附件")
        file_type = item.get("file_type", "")
        if summary:
            attachment_texts.append(f"[{file_name}] {summary}")
        if file_type.lower() in {".jpg", ".jpeg", ".png", ".webp"} and supports_vision:
            data_url = build_data_url(item.get("file_path", ""), file_type)
            if data_url:
                image_urls.append(data_url)
                add_source_label(f"基于上传图片 {file_name} 分析")
        elif summary:
            add_source_label(f"基于上传文件 {file_name}")

    history_lines = []
    for idx, record in enumerate(history[-6:], start=1):
        history_lines.append(f"第{idx}轮学生问题：{record.get('question', '')}\n第{idx}轮系统回答：{record.get('answer', '')}")

    system_prompt = (
        "你是课程专属 AI 助教。你的回答目标是让学生真正理解问题，而不是只让学生回去看资料。"
        "请优先结合 RAG 检索片段、课程资料、可解析附件和会话上下文回答；如果资料不足，也要补充高质量解释。"
        "直接输出回答正文，不要输出 JSON，不要输出 Markdown 代码块，不要输出 answer、sources、in_scope 等字段名。"
        "回答尽量自然分段，必要时可分点，但只返回正文本身。"
        "若附件中存在未解析文件，可以诚实说明边界。"
    )
    if language == "en-US":
        system_prompt += " The user interface is currently in English, so your entire answer must be written in natural English."
    user_text = (
        f"课程名称：{course_name or '未命名课程'}\n"
        f"RAG 检索命中片段：\n{_truncate(chr(10).join(retrieval_sections) or '暂无')}\n\n"
        f"课程资料摘要：\n{_truncate(course_context or '暂无课程资料')}\n\n"
        f"历史会话：\n{_truncate(chr(10).join(history_lines) or '暂无')}\n\n"
        f"可解析附件摘要：\n{_truncate(chr(10).join(attachment_texts) or '暂无')}\n\n"
        f"学生当前问题：{question}"
    )

    user_content: List[Dict[str, Any]] = [{"type": "text", "text": user_text}]
    for image_url in image_urls[:3]:
        user_content.append({"type": "image_url", "image_url": {"url": image_url}})

    call_result = _call_chat_model(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content if image_urls else user_text},
        ],
        model_key=model_key,
        max_tokens=2048,
        temperature=0.35,
    )

    used_model_key = call_result.get("used_model_key") or model_key or "default"
    used_model_name = call_result.get("used_model_name") or used_model_key
    provider = call_result.get("provider") or ""
    duration_ms = int(call_result.get("duration_ms") or 0)

    if not call_result.get("success"):
        error_message = call_result.get("error") or FALLBACK_NOTES["provider_unavailable"]
        answer = f"当前模型服务暂时不可用。\n\n{error_message}\n\n请稍后重试，或切换到其他已接入模型。"
        sources = source_labels + [f"本次尝试模型：{used_model_name}", f"模型调用状态：失败，耗时 {duration_ms} ms"]
        return {
            "answer": answer,
            "sources": sources,
            "in_scope": False,
            "used_model_key": used_model_key,
            "used_model_name": used_model_name,
            "model_status": "failed",
            "fallback_used": bool(call_result.get("fallback_used")),
        }

    response = str(call_result.get("content") or "").strip()
    data = _extract_json(response) if response else None

    if data and data.get("answer"):
        sources = [str(item) for item in data.get("sources", [])]
        for label in source_labels:
            if label not in sources:
                sources.append(label)
        sources.append(f"本次回答使用模型：{used_model_name}")
        sources.append(f"模型提供方：{provider or '默认'}")
        sources.append(f"模型调用状态：成功，耗时 {duration_ms} ms")
        if call_result.get("error"):
            sources.append(call_result["error"])
        return {
            "answer": _clean_answer_text(str(data.get("answer", ""))),
            "sources": sources,
            "in_scope": bool(data.get("in_scope", True)),
            "used_model_key": used_model_key,
            "used_model_name": used_model_name,
            "model_status": "ok",
            "fallback_used": bool(call_result.get("fallback_used")),
        }

    sources = source_labels + [f"本次回答使用模型：{used_model_name}", f"模型提供方：{provider or '默认'}", f"模型调用状态：成功，耗时 {duration_ms} ms"]
    if call_result.get("error"):
        sources.append(call_result["error"])
    return {
        "answer": _clean_answer_text(response),
        "sources": sources,
        "in_scope": True,
        "used_model_key": used_model_key,
        "used_model_name": used_model_name,
        "model_status": "ok",
        "fallback_used": bool(call_result.get("fallback_used")),
    }


def generate_weakness_analysis(question_texts: List[str], course_name: str = "") -> Dict[str, Any]:
    if not question_texts:
        return {
            "summary": "当前提问记录较少，系统暂时无法形成稳定诊断。建议先继续围绕核心概念、重点机制和典型案例开展提问。",
            "weak_points": [],
            "suggestions": ["继续积累本课程提问记录后再查看薄弱点分析。"],
        }

    joined = "\n".join([f"- {text}" for text in question_texts[:30]])
    prompt = (
        "请根据以下学生提问记录，温和地推断可能掌握较弱的知识点，并给出复习建议。"
        "只输出 JSON：{\"summary\":\"...\",\"weak_points\":[...],\"suggestions\":[...]}。\n"
        f"课程：{course_name or '未指定'}\n提问记录：\n{joined}"
    )
    call_result = _call_chat_model([
        {"role": "system", "content": "你是一位高校学习诊断助手，输出要温和、保守、可执行。"},
        {"role": "user", "content": prompt},
    ], model_key="default", max_tokens=1200, temperature=0.3)
    data = _extract_json(str(call_result.get("content") or "")) if call_result.get("success") else None
    if data:
        return {
            "summary": str(data.get("summary", "已根据提问记录生成学习诊断。")),
            "weak_points": [str(item) for item in data.get("weak_points", [])],
            "suggestions": [str(item) for item in data.get("suggestions", [])],
        }
    keywords = []
    for text in question_texts:
        for token in re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}|[\u4e00-\u9fa5]{2,8}", text):
            if token not in keywords:
                keywords.append(token)
    weak_points = keywords[:4]
    suggestions = [f"建议优先复习：{point}" for point in weak_points[:3]] or ["建议围绕高频提问概念做针对性复习。"]
    return {
        "summary": "系统发现你的提问主要集中在若干核心概念和机制理解上，建议按关键词逐步回看课堂内容并继续追问。",
        "weak_points": weak_points,
        "suggestions": suggestions,
    }


def generate_material_update(material_text: str, instructions: str, course_name: str = "", model_key: str = "default") -> Dict[str, Any]:
    prompt = (
        "请根据教师提供的旧材料和补充要求，生成课件更新建议。"
        "输出 JSON：{\"summary\":\"...\",\"update_suggestions\":[...],\"draft_pages\":[...],\"image_suggestions\":[...]}。\n"
        f"课程：{course_name or '未指定'}\n补充说明：{instructions or '未提供'}\n旧材料摘要：\n{_truncate(material_text or '暂无材料', 6000)}"
    )
    call_result = _call_chat_model([
        {"role": "system", "content": "你是一位高校教师课件更新顾问，擅长补充前沿热点、案例和PPT结构建议。"},
        {"role": "user", "content": prompt},
    ], model_key=model_key or "default", max_tokens=1800, temperature=0.35)
    used_model_key = call_result.get("used_model_key") or model_key or "default"
    used_model_name = call_result.get("used_model_name") or used_model_key

    if not call_result.get("success"):
        error_message = call_result.get("error") or FALLBACK_NOTES["provider_unavailable"]
        return {
            "summary": f"当前模型服务暂时不可用，未生成新的课件更新建议。原因：{error_message}",
            "update_suggestions": ["请检查 API Key、模型名称与服务地址，或切换到其他已接入模型后重试。"],
            "draft_pages": [],
            "image_suggestions": [],
            "selected_model": used_model_key,
            "used_model_name": used_model_name,
            "model_status": "failed",
        }

    data = _extract_json(str(call_result.get("content") or "")) if call_result.get("success") else None
    if data:
        return {
            "summary": str(data.get("summary", "已生成课件更新建议。")),
            "update_suggestions": [str(item) for item in data.get("update_suggestions", [])],
            "draft_pages": [str(item) for item in data.get("draft_pages", [])],
            "image_suggestions": [str(item) for item in data.get("image_suggestions", [])],
            "selected_model": used_model_key,
            "used_model_name": used_model_name,
            "model_status": "ok",
        }
    return {
        "summary": "模型已返回内容，但未能解析为结构化结果，请调整提示词或切换模型后重试。",
        "update_suggestions": ["建议保留旧材料关键章节，再补 1 到 2 页前沿热点与案例分析。"],
        "draft_pages": ["建议新增：前沿技术背景页", "建议新增：课程关联案例页"],
        "image_suggestions": ["可补充技术路线图、时间线或应用场景图。"],
        "selected_model": used_model_key,
        "used_model_name": used_model_name,
        "model_status": "ok",
    }


def generate_lesson_pack(course: Course) -> LessonPack:
    prompt = (
        "请为以下课程生成结构化课程包，输出 JSON，包含 teaching_objectives, prerequisites, main_thread, frontier_topic, time_allocation, ppt_outline, teacher_tips, case_materials, discussion_questions, after_class_tasks, extended_reading, risk_warning, references。\n"
        f"课程名称：{course.name}\n授课对象：{course.audience}\n学生水平：{course.student_level}\n当前章节：{course.chapter}\n课程目标：{course.objectives}\n时长：{course.duration_minutes} 分钟\n前沿方向：{course.frontier_direction}"
    )
    call_result = _call_chat_model([
        {"role": "system", "content": "你是一位高校教学设计顾问，只返回 JSON。"},
        {"role": "user", "content": prompt},
    ], model_key="default", max_tokens=3000, temperature=0.45)
    payload = _extract_json(str(call_result.get("content") or "")) if call_result.get("success") else None
    if payload is None:
        from .mock_data import mock_generate_lesson_pack
        return mock_generate_lesson_pack(course)
    return LessonPack(id=f"lp-{uuid.uuid4().hex[:8]}", course_id=course.id, version=1, status="draft", payload=payload, created_at=datetime_now())


def analytics_from_qa_logs(lesson_pack_id: str, qa_logs: List[Dict]) -> AnalyticsReport:
    if not qa_logs:
        from .mock_data import mock_analytics
        return mock_analytics(lesson_pack_id)

    joined = "\n".join([f"Q: {log.get('question','')}\nA: {log.get('answer','')}" for log in qa_logs[:30]])
    call_result = _call_chat_model([
        {"role": "system", "content": "你是一位教学分析师，只返回 JSON：{\"high_freq_topics\":[],\"confused_concepts\":[],\"knowledge_gaps\":[],\"teaching_suggestions\":[]}。"},
        {"role": "user", "content": f"课程包ID：{lesson_pack_id}\n问答记录：\n{joined}"},
    ], model_key="default", max_tokens=1500, temperature=0.3)
    data = _extract_json(str(call_result.get("content") or "")) if call_result.get("success") else None
    if data:
        return AnalyticsReport(
            lesson_pack_id=lesson_pack_id,
            total_questions=len(qa_logs),
            high_freq_topics=[str(item) for item in data.get("high_freq_topics", [])],
            confused_concepts=[str(item) for item in data.get("confused_concepts", [])],
            knowledge_gaps=[str(item) for item in data.get("knowledge_gaps", [])],
            teaching_suggestions=[str(item) for item in data.get("teaching_suggestions", [])],
            recent_questions=[],
        )
    from .mock_data import mock_analytics
    report = mock_analytics(lesson_pack_id)
    report.total_questions = len(qa_logs)
    return report


def assignment_review_preview(body: AssignmentReviewRequest) -> AssignmentReviewResponse:
    prompt = (
        "请对以下学生提交内容给出作业辅助批改参考，只返回 JSON："
        "{\"summary\":\"...\",\"structure_feedback\":[...],\"logic_feedback\":[...],\"writing_feedback\":[...],\"rubric_reference\":[...],\"teacher_note\":\"...\"}。\n"
        f"课程编号：{body.course_id or '未指定'}\n任务类型：{body.assignment_type}\n标题：{body.title}\n任务要求：{body.requirements or '未提供'}\n学生提交内容：{body.submission_text}"
    )
    call_result = _call_chat_model([
        {"role": "system", "content": "你是一位高校作业辅助批改助手，不提供最终评分，只提供结构化参考建议。"},
        {"role": "user", "content": prompt},
    ], model_key="default", max_tokens=1800, temperature=0.3)
    data = _extract_json(str(call_result.get("content") or "")) if call_result.get("success") else None
    if data:
        return AssignmentReviewResponse(
            summary=str(data.get("summary", "系统已生成辅助批改参考。")),
            structure_feedback=[str(item) for item in data.get("structure_feedback", [])],
            logic_feedback=[str(item) for item in data.get("logic_feedback", [])],
            writing_feedback=[str(item) for item in data.get("writing_feedback", [])],
            rubric_reference=[str(item) for item in data.get("rubric_reference", [])],
            teacher_note=str(data.get("teacher_note", "请教师结合评分标准完成最终判断。")),
        )
    return AssignmentReviewResponse(
        summary="该提交已具备基础内容，但仍需教师结合课程要求进一步复核。",
        structure_feedback=["建议检查引言、主体分析和结论是否完整对应任务要求。"],
        logic_feedback=["建议核对论点与论据的对应关系，避免只罗列观点而缺少展开。"],
        writing_feedback=["建议统一术语表达，进一步提升学术规范性。"],
        rubric_reference=["完成度、逻辑性、规范性可作为重点复核维度。"],
        teacher_note="当前结果为辅助批改参考，不提供自动评分。",
    )


def datetime_now() -> str:
    from datetime import datetime
    return datetime.now().isoformat()


def student_qa(question: str, lesson_pack: LessonPack):
    payload = ask_course_assistant(
        question=question,
        course_name=str(lesson_pack.payload.get("frontier_topic", {}).get("name", "课程问答")),
        course_context=json.dumps(lesson_pack.payload, ensure_ascii=False),
        history=[],
        attachment_contexts=[],
        model_key="default",
    )
    from ..models.schemas import QAResponse
    return QAResponse(answer=payload["answer"], evidence=payload["sources"], in_scope=payload["in_scope"])
