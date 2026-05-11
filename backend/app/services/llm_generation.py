from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..models.schemas import AnalyticsReport, AssignmentReviewRequest, AssignmentReviewResponse, Course, LessonPack
from .file_extractors import build_data_url
from .llm_runtime import (
    FALLBACK_NOTES,
    _call_chat_model,
    _clean_answer_text,
    _extract_json,
    _get_model_config,
    _truncate,
)


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
    call_result = _call_chat_model(
        [
            {"role": "system", "content": "你是一位高校学习诊断助手，输出要温和、保守、可执行。"},
            {"role": "user", "content": prompt},
        ],
        model_key="default",
        max_tokens=1200,
        temperature=0.3,
    )
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
    call_result = _call_chat_model(
        [
            {"role": "system", "content": "你是一位高校教师课件更新顾问，擅长补充前沿热点、案例和PPT结构建议。"},
            {"role": "user", "content": prompt},
        ],
        model_key=model_key or "default",
        max_tokens=1800,
        temperature=0.35,
    )
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
    call_result = _call_chat_model(
        [
            {"role": "system", "content": "你是一位高校教学设计顾问，只返回 JSON。"},
            {"role": "user", "content": prompt},
        ],
        model_key="default",
        max_tokens=3000,
        temperature=0.45,
    )
    payload = _extract_json(str(call_result.get("content") or "")) if call_result.get("success") else None
    if payload is None:
        from .mock_data import mock_generate_lesson_pack

        return mock_generate_lesson_pack(course)
    return LessonPack(id=f"lp-{uuid.uuid4().hex[:8]}", course_id=course.id, version=1, status="draft", payload=payload, created_at=datetime_now())


def _lesson_pack_as_clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _lesson_pack_as_text_list(value: Any) -> List[str]:
    if isinstance(value, list):
        items: List[str] = []
        for item in value:
            text = _lesson_pack_as_clean_text(item)
            if text:
                items.append(text)
        return items
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    return []


def _lesson_pack_merge_text_list(value: Any, fallback: List[str], *, minimum: int = 1) -> List[str]:
    merged: List[str] = []
    seen: set[str] = set()
    for candidate in _lesson_pack_as_text_list(value) + list(fallback):
        if candidate and candidate not in seen:
            seen.add(candidate)
            merged.append(candidate)
    if not merged:
        return list(fallback)
    return merged[: max(minimum, len(merged))]


def _lesson_pack_normalize_frontier_topic(value: Any, fallback: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(fallback)
    if isinstance(value, dict):
        for key in ("name", "insert_position", "time_suggestion", "connection_to_core"):
            text = _lesson_pack_as_clean_text(value.get(key))
            if text:
                merged[key] = text
    elif isinstance(value, str) and value.strip():
        merged["name"] = value.strip()
    return merged


def _lesson_pack_normalize_time_allocation(value: Any, fallback: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    if isinstance(value, list):
        for index, item in enumerate(value):
            fallback_item = fallback[min(index, len(fallback) - 1)]
            if isinstance(item, dict):
                segment = _lesson_pack_as_clean_text(item.get("segment"))
                if not segment:
                    continue
                minutes = item.get("minutes")
                objective = _lesson_pack_as_clean_text(item.get("objective"))
                normalized.append(
                    {
                        "segment": segment,
                        "minutes": minutes if minutes not in (None, "") else fallback_item.get("minutes"),
                        "objective": objective or fallback_item.get("objective", ""),
                    }
                )
            elif isinstance(item, str) and item.strip():
                normalized.append(
                    {
                        "segment": item.strip(),
                        "minutes": fallback_item.get("minutes"),
                        "objective": fallback_item.get("objective", ""),
                    }
                )
    return normalized or list(fallback)


def _lesson_pack_normalize_structured_groups(value: Any, fallback: Dict[str, List[str]]) -> Dict[str, List[str]]:
    normalized = {key: list(items) for key, items in fallback.items()}
    if isinstance(value, dict):
        for key in normalized:
            normalized[key] = _lesson_pack_merge_text_list(value.get(key), normalized[key], minimum=1)
    return normalized


def _normalize_lesson_pack_payload(course: Course, payload: Dict[str, Any]) -> Dict[str, Any]:
    from .mock_data import build_mock_lesson_pack_payload

    fallback = build_mock_lesson_pack_payload(course)
    normalized: Dict[str, Any] = dict(fallback)

    for key in (
        "teaching_objectives",
        "prerequisites",
        "learning_diagnostics",
        "key_concepts",
        "teaching_difficulties",
        "segment_plan",
        "ppt_outline",
        "board_plan",
        "teacher_tips",
        "case_materials",
        "interaction_plan",
        "discussion_questions",
        "assessment_plan",
        "after_class_tasks",
        "extended_reading",
        "common_misconceptions",
        "expected_outputs",
        "fallback_plan",
        "references",
    ):
        fallback_list = list(fallback[key])
        normalized[key] = _lesson_pack_merge_text_list(payload.get(key), fallback_list, minimum=max(1, min(len(fallback_list), 3)))

    main_thread = _lesson_pack_as_clean_text(payload.get("main_thread"))
    normalized["main_thread"] = main_thread or fallback["main_thread"]

    risk_warning = _lesson_pack_as_clean_text(payload.get("risk_warning"))
    normalized["risk_warning"] = risk_warning or fallback["risk_warning"]

    class_profile = payload.get("class_profile")
    if isinstance(class_profile, dict):
        merged_profile = dict(fallback["class_profile"])
        for key in ("audience", "current_level"):
            text = _lesson_pack_as_clean_text(class_profile.get(key))
            if text:
                merged_profile[key] = text
        for key in ("likely_strengths", "likely_risks"):
            merged_profile[key] = _lesson_pack_merge_text_list(class_profile.get(key), fallback["class_profile"][key], minimum=1)
        normalized["class_profile"] = merged_profile
    else:
        normalized["class_profile"] = fallback["class_profile"]

    normalized["frontier_topic"] = _lesson_pack_normalize_frontier_topic(payload.get("frontier_topic"), fallback["frontier_topic"])
    normalized["time_allocation"] = _lesson_pack_normalize_time_allocation(payload.get("time_allocation"), fallback["time_allocation"])
    normalized["differentiation_support"] = _lesson_pack_normalize_structured_groups(payload.get("differentiation_support"), fallback["differentiation_support"])
    return normalized

def _material_update_list(value: Any, fallback: List[str], *, minimum: int = 2) -> List[str]:
    items: List[str] = []
    if isinstance(value, list):
        items = [str(item).strip() for item in value if str(item).strip()]
    elif isinstance(value, str) and value.strip():
        items = [value.strip()]
    merged: List[str] = []
    seen: set[str] = set()
    for candidate in items + list(fallback):
        if candidate and candidate not in seen:
            seen.add(candidate)
            merged.append(candidate)
    return merged[: max(minimum, len(merged))]


def _normalize_material_update_result(data: Dict[str, Any], *, course_name: str, instructions: str) -> Dict[str, Any]:
    topic = course_name or "当前课程"
    instruction_focus = instructions.strip() or "补充近年的前沿案例、课堂互动和可直接落地的讲授安排"
    fallback = {
        "summary": f"本次更新建议围绕“{topic}”补强内容结构、案例新鲜度和课堂可执行性，重点响应：{instruction_focus}。",
        "update_suggestions": [
            "先定位旧材料中最需要更新的章节，再明确哪些内容保留、哪些内容替换、哪些内容前移或后置。",
            "把前沿案例和真实应用场景嵌入原有知识主线，而不是单独加在最后形成割裂内容。",
            "每个新增页面都要同时考虑讲授逻辑、互动方式和学生最终要带走的核心结论。",
        ],
        "draft_pages": [
            "新增页 1：为什么要更新这一节内容，旧知识在哪些场景下解释力不足。",
            "新增页 2：近两年真实案例 / 数据 / 行业动态，与原章节知识做对应分析。",
            "新增页 3：课堂互动题与总结页，帮助学生把新增内容转化为自己的理解。",
        ],
        "image_suggestions": [
            "补充一张技术演进时间线或问题-方案对照图。",
            "补充一张真实案例流程图、系统架构图或性能对比图。",
        ],
        "teaching_flow": [
            "先用旧材料中的核心概念做短回顾，再指出为什么这一部分需要更新。",
            "随后用新增案例解释变化的背景、关键机制和与原知识点的连接方式。",
            "最后用互动提问和总结收束，避免更新内容只停留在资讯层面。",
        ],
        "speaker_notes": [
            "讲授时先说明旧内容的价值，再解释为什么要补这一页，减少学生对新旧内容割裂的感受。",
            "每讲完一个新增点，就用一句“这会改变我们原来如何理解这一节”帮助学生建立迁移。",
        ],
        "classroom_interactions": [
            "安排一个对比提问：旧方案在什么情况下不够用了，新方案解决了什么问题。",
            "安排一个小型讨论：如果把新增案例放到学生熟悉的场景，会带来什么影响。",
        ],
        "assessment_checkpoints": [
            "用 1 到 2 个需要解释原因的课堂问题检查学生是否真正理解新增内容。",
            "要求学生用自己的话说出“旧知识 - 新变化 - 实际影响”的链路。",
        ],
        "delivery_checklist": [
            "确认新增页面数量与原始课时长度匹配，不要因为补内容导致主线被挤压。",
            "确认每个新增页面都有明确用途：引入、分析、互动、总结，而不是只堆信息。",
        ],
        "reference_updates": [
            "补充一篇近两年的综述、标准更新或权威技术博客作为课后延伸。",
            "补充一个真实行业案例来源，便于教师后续继续扩展讲义。",
        ],
    }
    return {
        "summary": str(data.get("summary") or fallback["summary"]),
        "update_suggestions": _material_update_list(data.get("update_suggestions"), fallback["update_suggestions"]),
        "draft_pages": _material_update_list(data.get("draft_pages"), fallback["draft_pages"]),
        "image_suggestions": _material_update_list(data.get("image_suggestions"), fallback["image_suggestions"], minimum=1),
        "teaching_flow": _material_update_list(data.get("teaching_flow"), fallback["teaching_flow"]),
        "speaker_notes": _material_update_list(data.get("speaker_notes"), fallback["speaker_notes"], minimum=1),
        "classroom_interactions": _material_update_list(data.get("classroom_interactions"), fallback["classroom_interactions"], minimum=1),
        "assessment_checkpoints": _material_update_list(data.get("assessment_checkpoints"), fallback["assessment_checkpoints"], minimum=1),
        "delivery_checklist": _material_update_list(data.get("delivery_checklist"), fallback["delivery_checklist"], minimum=1),
        "reference_updates": _material_update_list(data.get("reference_updates"), fallback["reference_updates"], minimum=1),
    }


def generate_material_update(
    material_text: str,
    instructions: str,
    course_name: str = "",
    course_context: str = "",
    model_key: str = "default",
) -> Dict[str, Any]:
    prompt = (
        "请根据教师提供的旧材料、课程上下文和补充要求，生成一份可直接指导 PPT / 教案更新的结构化方案。"
        "输出 JSON，包含字段：summary, update_suggestions, draft_pages, image_suggestions, teaching_flow, "
        "speaker_notes, classroom_interactions, assessment_checkpoints, delivery_checklist, reference_updates。"
        "要求：新增内容要和原章节主线相连，结果必须具体到页面、讲法、互动和检查点。\n"
        f"课程名称：{course_name or '未指定'}\n"
        f"课程上下文：\n{course_context or '未提供课程上下文'}\n"
        f"补充说明：{instructions or '未提供'}\n"
        f"旧材料摘要：\n{_truncate(material_text or '暂无材料', 6000)}"
    )
    call_result = _call_chat_model(
        [
            {"role": "system", "content": "你是一位高校教师的课件与教案升级顾问，擅长把旧材料整理成可执行的更新方案。只返回 JSON。"},
            {"role": "user", "content": prompt},
        ],
        model_key=model_key or "default",
        max_tokens=2600,
        temperature=0.35,
    )
    used_model_key = call_result.get("used_model_key") or model_key or "default"
    used_model_name = call_result.get("used_model_name") or used_model_key
    fallback_result = _normalize_material_update_result({}, course_name=course_name, instructions=instructions)

    if not call_result.get("success"):
        error_message = call_result.get("error") or FALLBACK_NOTES["provider_unavailable"]
        return {
            **fallback_result,
            "summary": f"当前模型服务暂时不可用，未生成新的课件更新建议。原因：{error_message}",
            "selected_model": used_model_key,
            "used_model_name": used_model_name,
            "model_status": "failed",
        }

    data = _extract_json(str(call_result.get("content") or "")) if call_result.get("success") else None
    normalized = _normalize_material_update_result(data or {}, course_name=course_name, instructions=instructions)
    return {
        **normalized,
        "selected_model": used_model_key,
        "used_model_name": used_model_name,
        "model_status": "ok",
    }


def _normalize_material_generation_result(
    data: Dict[str, Any],
    *,
    course_name: str,
    instructions: str,
    generation_mode: str,
    target_format: str,
) -> Dict[str, Any]:
    topic = course_name or "当前课程"
    instruction_focus = instructions.strip() or "补充核心知识、课堂互动和可直接落地的讲授安排"
    direct_generation = generation_mode == "generate_new"
    target_label = "PPT" if target_format == "ppt" else "教案"
    summary = (
        f"本次将围绕“{topic}”直接生成一份可用于授课的{target_label}方案，重点响应：{instruction_focus}。"
        if direct_generation
        else f"本次更新建议围绕“{topic}”补强内容结构、案例新鲜度和课堂可执行性，重点响应：{instruction_focus}。"
    )
    fallback = {
        "summary": summary,
        "update_suggestions": [
            "先明确这次产出的主线、课时目标和重点学生收获，再安排内容顺序。",
            "把案例、板书、互动和检测点一起设计，避免只生成内容提纲。",
            "每一页或每一个教学环节都说明教师讲什么、学生做什么、最后形成什么结论。",
        ],
        "draft_pages": [
            "第 1 页：课程导入、学习目标与本节主线。",
            "第 2 页：核心概念或关键机制讲解，配结构图或流程图。",
            "第 3 页：案例分析、课堂互动与总结收束。",
        ],
        "image_suggestions": [
            "建议补充一张结构示意图、流程图或对比图，帮助快速建立整体认知。",
            "建议补充一张真实案例配图或时间线，增强课堂代入感。",
        ],
        "teaching_flow": [
            "先用问题或场景导入，说明本节课为什么值得学。",
            "再按核心概念到案例应用的顺序展开，避免知识点堆砌。",
            "最后通过互动提问或总结板书收束，帮助学生建立完整链路。",
        ],
        "speaker_notes": [
            "教师讲解时先给结论，再解释为什么这样设计，减少学生的理解跳跃。",
            "每讲完一个重点，补一句“它与本章主线的关系是什么”，帮助学生形成结构化理解。",
        ],
        "classroom_interactions": [
            "安排一个判断或对比问题，让学生先说出自己的直觉，再进入讲解。",
            "安排一个小型讨论或随堂问答，把新内容和学生熟悉场景建立联系。",
        ],
        "assessment_checkpoints": [
            "设置 1 到 2 个需要解释原因的检测点，确认学生不是只记住表面结论。",
            "要求学生复述“概念 - 机制 - 应用”的关系，检查是否真正形成迁移。",
        ],
        "delivery_checklist": [
            "确认页数和课时长度匹配，不要让内容膨胀影响主线。",
            "确认每一页都有明确教学作用：导入、讲解、互动、总结之一。",
        ],
        "reference_updates": [
            "补充一篇近两年的权威资料或综述，方便课后延伸。",
            "补充一个真实案例来源，便于后续继续扩展。",
        ],
    }
    return {
        "generation_mode": generation_mode,
        "target_format": target_format,
        "summary": str(data.get("summary") or fallback["summary"]),
        "update_suggestions": _material_update_list(data.get("update_suggestions"), fallback["update_suggestions"]),
        "draft_pages": _material_update_list(data.get("draft_pages"), fallback["draft_pages"]),
        "image_suggestions": _material_update_list(data.get("image_suggestions"), fallback["image_suggestions"], minimum=1),
        "teaching_flow": _material_update_list(data.get("teaching_flow"), fallback["teaching_flow"]),
        "speaker_notes": _material_update_list(data.get("speaker_notes"), fallback["speaker_notes"], minimum=1),
        "classroom_interactions": _material_update_list(data.get("classroom_interactions"), fallback["classroom_interactions"], minimum=1),
        "assessment_checkpoints": _material_update_list(data.get("assessment_checkpoints"), fallback["assessment_checkpoints"], minimum=1),
        "delivery_checklist": _material_update_list(data.get("delivery_checklist"), fallback["delivery_checklist"], minimum=1),
        "reference_updates": _material_update_list(data.get("reference_updates"), fallback["reference_updates"], minimum=1),
    }


def generate_material_update(
    material_text: str,
    instructions: str,
    course_name: str = "",
    course_context: str = "",
    generation_mode: str = "update_existing",
    target_format: str = "ppt",
    model_key: str = "default",
) -> Dict[str, Any]:
    direct_generation = generation_mode == "generate_new"
    target_label = "PPT" if target_format == "ppt" else "教案"
    prompt = (
        f"请根据教师提供的课程上下文、补充要求和参考材料，生成一份可直接用于{target_label}{'生成' if direct_generation else '更新'}的结构化方案。"
        "输出 JSON，包含字段：summary, update_suggestions, draft_pages, image_suggestions, teaching_flow, "
        "speaker_notes, classroom_interactions, assessment_checkpoints, delivery_checklist, reference_updates。\n"
        f"生成模式：{'direct_generate' if direct_generation else 'update_existing'}\n"
        f"目标产物：{target_label}\n"
        f"课程名称：{course_name or '未指定'}\n"
        f"课程上下文：\n{course_context or '未提供课程上下文'}\n"
        f"补充说明：{instructions or '未提供'}\n"
        f"{'参考材料摘要' if direct_generation else '旧材料摘要'}：\n{_truncate(material_text or '暂无材料', 6000)}"
    )
    call_result = _call_chat_model(
        [
            {"role": "system", "content": "你是一位高校教师的课件与教案生成顾问，擅长把课程信息整理成可直接执行的 PPT 或教案方案。只返回 JSON。"},
            {"role": "user", "content": prompt},
        ],
        model_key=model_key or "default",
        max_tokens=2600,
        temperature=0.35,
    )
    used_model_key = call_result.get("used_model_key") or model_key or "default"
    used_model_name = call_result.get("used_model_name") or used_model_key
    fallback_result = _normalize_material_generation_result(
        {},
        course_name=course_name,
        instructions=instructions,
        generation_mode=generation_mode,
        target_format=target_format,
    )

    if not call_result.get("success"):
        error_message = call_result.get("error") or FALLBACK_NOTES["provider_unavailable"]
        return {
            **fallback_result,
            "summary": f"当前模型服务暂时不可用，未完成{target_label}{'生成' if direct_generation else '更新方案生成'}。原因：{error_message}",
            "selected_model": used_model_key,
            "used_model_name": used_model_name,
            "model_status": "failed",
        }

    data = _extract_json(str(call_result.get("content") or "")) if call_result.get("success") else None
    normalized = _normalize_material_generation_result(
        data or {},
        course_name=course_name,
        instructions=instructions,
        generation_mode=generation_mode,
        target_format=target_format,
    )
    return {
        **normalized,
        "selected_model": used_model_key,
        "used_model_name": used_model_name,
        "model_status": "ok",
    }


def generate_lesson_pack(course: Course) -> LessonPack:
    prompt = (
        "Generate a classroom-ready lesson pack in JSON only. "
        "Write the content in concise, teacher-friendly Simplified Chinese when the course input is Chinese. "
        "The lesson pack must be comprehensive enough for direct teaching preparation, not just a short outline. "
        "Return an object with these keys: "
        "teaching_objectives, prerequisites, class_profile, learning_diagnostics, key_concepts, teaching_difficulties, "
        "main_thread, frontier_topic, time_allocation, segment_plan, ppt_outline, board_plan, teacher_tips, case_materials, "
        "interaction_plan, discussion_questions, assessment_plan, differentiation_support, after_class_tasks, "
        "extended_reading, common_misconceptions, expected_outputs, fallback_plan, risk_warning, references. "
        "Keep the time allocation close to the course duration, connect the frontier topic to the chapter, and include "
        "diagnostic checks, interaction design, assessment, and differentiated support.\n"
        f"Course name: {course.name}\n"
        f"Audience: {course.audience}\n"
        f"Student level: {course.student_level}\n"
        f"Current chapter: {course.chapter}\n"
        f"Course objective: {course.objectives}\n"
        f"Duration: {course.duration_minutes} minutes\n"
        f"Frontier direction: {course.frontier_direction}"
    )
    call_result = _call_chat_model(
        [
            {
                "role": "system",
                "content": "You are a senior higher-education instructional designer. Return JSON only and prioritize depth, usability, and classroom execution details.",
            },
            {"role": "user", "content": prompt},
        ],
        model_key="default",
        max_tokens=3000,
        temperature=0.45,
    )
    payload = _extract_json(str(call_result.get("content") or "")) if call_result.get("success") else None
    if payload is None:
        from .mock_data import mock_generate_lesson_pack

        return mock_generate_lesson_pack(course)
    normalized_payload = _normalize_lesson_pack_payload(course, payload)
    return LessonPack(id=f"lp-{uuid.uuid4().hex[:8]}", course_id=course.id, version=1, status="draft", payload=normalized_payload, created_at=datetime_now())


def analytics_from_qa_logs(lesson_pack_id: str, qa_logs: List[Dict]) -> AnalyticsReport:
    if not qa_logs:
        from .mock_data import mock_analytics

        return mock_analytics(lesson_pack_id)

    joined = "\n".join([f"Q: {log.get('question', '')}\nA: {log.get('answer', '')}" for log in qa_logs[:30]])
    call_result = _call_chat_model(
        [
            {"role": "system", "content": "你是一位教学分析师，只返回 JSON：{\"high_freq_topics\":[],\"confused_concepts\":[],\"knowledge_gaps\":[],\"teaching_suggestions\":[]}。"},
            {"role": "user", "content": f"课程包ID：{lesson_pack_id}\n问答记录：\n{joined}"},
        ],
        model_key="default",
        max_tokens=1500,
        temperature=0.3,
    )
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
    call_result = _call_chat_model(
        [
            {"role": "system", "content": "你是一位高校作业辅助批改助手，不提供最终评分，只提供结构化参考建议。"},
            {"role": "user", "content": prompt},
        ],
        model_key="default",
        max_tokens=1800,
        temperature=0.3,
    )
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
    scope_rules: str = "仅围绕课程内容、教师上传资料和已开放的学习支持范围回答。",
    answer_style: str = "讲解型",
    enable_homework_support: bool = True,
    enable_material_qa: bool = True,
    enable_frontier_extension: bool = True,
) -> Dict[str, Any]:
    attachment_texts: List[str] = []
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

    effective_chunks = list(retrieved_chunks or [])
    if not enable_material_qa:
        effective_chunks = []
        add_source_label("课程资料问答能力：已关闭（使用通用讲解模式）")

    for idx, item in enumerate(effective_chunks[:8], start=1):
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

    if retrieval_sections:
        for source_hit in retrieval_source_hits.values():
            tags = "/".join(source_hit["tags"][:4])
            add_source_label(f"检索命中[{tags}] {source_hit['source_name']}（{source_hit['source_type']}）")
    else:
        add_source_label("未命中课程资料检索片段（本次回答更多依赖通用知识与上下文）")

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

    history_lines: List[str] = []
    for idx, record in enumerate(history[-3:], start=1):
        history_lines.append(
            f"第{idx}轮学生问题：{record.get('question', '')}\n第{idx}轮系统回答：{record.get('answer', '')}"
        )

    style_guidance = {
        "讲解型": "用分步骤、概念解释和简短例子帮助理解。",
        "启发型": "多用追问与提示，引导学生自己得出结论。",
        "精炼型": "先给结论，再给最关键的2-4条依据，避免冗长。",
    }.get(answer_style, "回答清晰、准确、结构化。")

    capability_lines = [
        f"- 作业支持：{'开启' if enable_homework_support else '关闭'}",
        f"- 资料问答：{'开启' if enable_material_qa else '关闭'}",
        f"- 前沿拓展：{'开启' if enable_frontier_extension else '关闭'}",
    ]

    system_prompt = (
        "你是课程专属 AI 助教。目标是帮助学生真正理解，而不是只复述资料标题。\n"
        f"教师设定的知识边界：{scope_rules}\n"
        f"回答风格：{answer_style}。风格要求：{style_guidance}\n"
        "能力开关：\n"
        + "\n".join(capability_lines)
        + "\n"
        + "请优先参考 RAG 检索片段、课程资料、可解析附件与近期会话。"
        + "当证据不足时，明确说明“资料中未直接命中”，再给出保守解释。"
        + "不要输出 JSON，不要输出字段名，只输出回答正文。"
    )
    if not enable_frontier_extension:
        system_prompt += " 不要扩展到课程边界之外的前沿话题。"
    if not enable_homework_support:
        system_prompt += " 不提供直接作业答案，改为提供思路与检查清单。"
    if language == "en-US":
        system_prompt += " The interface is in English, so answer fully in natural English."

    user_text = (
        f"课程名称：{course_name or '未命名课程'}\n"
        f"RAG检索命中片段：\n{_truncate(chr(10).join(retrieval_sections) or '暂无', 2200)}\n\n"
        f"课程资料摘要：\n{_truncate(course_context or '暂无课程资料', 2200)}\n\n"
        f"历史会话：\n{_truncate(chr(10).join(history_lines) or '暂无', 1200)}\n\n"
        f"可解析附件摘要：\n{_truncate(chr(10).join(attachment_texts) or '暂无', 1600)}\n\n"
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
        max_tokens=1900,
        temperature=0.3,
    )

    used_model_key = call_result.get("used_model_key") or model_key or "default"
    used_model_name = call_result.get("used_model_name") or used_model_key
    provider = call_result.get("provider") or ""
    duration_ms = int(call_result.get("duration_ms") or 0)

    if not call_result.get("success"):
        error_message = call_result.get("error") or FALLBACK_NOTES["provider_unavailable"]
        answer = (
            "当前模型服务暂时不可用。\n\n"
            f"{error_message}\n\n"
            "请稍后重试，或切换到其他已接入模型。"
        )
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
    answer_text = _clean_answer_text(str(data.get("answer", ""))) if isinstance(data, dict) and data.get("answer") else _clean_answer_text(response)

    sources = [str(item) for item in data.get("sources", [])] if isinstance(data, dict) else []
    for label in source_labels:
        if label not in sources:
            sources.append(label)
    sources.append(f"本次回答使用模型：{used_model_name}")
    sources.append(f"模型提供方：{provider or '默认'}")
    sources.append(f"模型调用状态：成功，耗时 {duration_ms} ms")
    if call_result.get("error"):
        sources.append(str(call_result["error"]))

    in_scope = bool(data.get("in_scope", True)) if isinstance(data, dict) else True
    return {
        "answer": answer_text,
        "sources": sources,
        "in_scope": in_scope,
        "used_model_key": used_model_key,
        "used_model_name": used_model_name,
        "model_status": "ok",
        "fallback_used": bool(call_result.get("fallback_used")),
    }
