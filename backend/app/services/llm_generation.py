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
    _dedupe_text_parts,
    _extract_json,
    _get_model_config,
    _truncate,
)



def _stringify_lesson_pack_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, dict):
        preferred_keys = (
            "title",
            "name",
            "content",
            "description",
            "summary",
            "text",
            "question",
            "task",
            "activity",
            "significance",
            "core_content",
            "core_question",
            "narrative_arc",
        )
        parts: List[str] = []
        for key in preferred_keys:
            rendered = _stringify_lesson_pack_value(value.get(key))
            if rendered:
                parts.append(rendered)
        if parts:
            return " | ".join(_dedupe_text_parts(parts))
        generic_parts = []
        for key, item in value.items():
            rendered = _stringify_lesson_pack_value(item)
            if rendered:
                generic_parts.append(f"{key}: {rendered}")
        return "; ".join(generic_parts)
    if isinstance(value, list):
        parts = [_stringify_lesson_pack_value(item) for item in value]
        return "; ".join([part for part in parts if part])
    return str(value).strip()


def _normalize_lesson_pack_list(value: Any) -> List[str]:
    if isinstance(value, dict) and isinstance(value.get("slides"), list):
        return _normalize_lesson_pack_list(value.get("slides"))
    if isinstance(value, list):
        items: List[str] = []
        for item in value:
            if isinstance(item, list):
                items.extend(_normalize_lesson_pack_list(item))
                continue
            rendered = _stringify_lesson_pack_value(item)
            if rendered:
                items.append(rendered)
        return _dedupe_text_parts(items)
    if isinstance(value, dict):
        items: List[str] = []
        for key, item in value.items():
            normalized_key = str(key).replace("_", " ").strip()
            if isinstance(item, list):
                for child in _normalize_lesson_pack_list(item):
                    items.append(f"{normalized_key}: {child}")
                continue
            rendered = _stringify_lesson_pack_value(item)
            if rendered:
                items.append(f"{normalized_key}: {rendered}")
        return _dedupe_text_parts(items)
    rendered = _stringify_lesson_pack_value(value)
    return [rendered] if rendered else []


def _normalize_frontier_topic(value: Any, course: Course) -> Dict[str, Any]:
    if isinstance(value, dict):
        name = (
            _stringify_lesson_pack_value(value.get("name"))
            or _stringify_lesson_pack_value(value.get("topic_name"))
            or _stringify_lesson_pack_value(value.get("title"))
            or course.frontier_direction
            or course.name
        )
        insert_position = (
            _stringify_lesson_pack_value(value.get("insert_position"))
            or _stringify_lesson_pack_value(value.get("position"))
            or "After the core concepts"
        )
        time_suggestion = (
            _stringify_lesson_pack_value(value.get("time_suggestion"))
            or _stringify_lesson_pack_value(value.get("duration"))
            or _stringify_lesson_pack_value(value.get("recommended_time"))
            or "15-20 minutes"
        )
        normalized = {
            "name": name,
            "insert_position": insert_position,
            "time_suggestion": time_suggestion,
        }
        highlights = _normalize_lesson_pack_list(value.get("topics") or value.get("subtopics"))
        if highlights:
            normalized["highlights"] = highlights[:6]
        return normalized
    name = _stringify_lesson_pack_value(value) or course.frontier_direction or course.name
    return {
        "name": name,
        "insert_position": "After the core concepts",
        "time_suggestion": "15-20 minutes",
    }


def _normalize_time_allocation(value: Any) -> List[Dict[str, Any]]:
    if isinstance(value, dict) and isinstance(value.get("segments"), list):
        value = value.get("segments")
    if isinstance(value, list):
        result: List[Dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                segment = (
                    _stringify_lesson_pack_value(item.get("segment"))
                    or _stringify_lesson_pack_value(item.get("phase"))
                    or _stringify_lesson_pack_value(item.get("title"))
                    or "Teaching segment"
                )
                minutes = item.get("minutes") or item.get("duration_minutes") or item.get("duration") or item.get("time") or ""
                entry: Dict[str, Any] = {
                    "segment": segment,
                    "minutes": str(minutes).strip() if minutes not in (None, "") else "",
                }
                activities = _normalize_lesson_pack_list(item.get("activities") or item.get("content"))
                if activities:
                    entry["activities"] = activities[:4]
                result.append(entry)
            else:
                rendered = _stringify_lesson_pack_value(item)
                if rendered:
                    result.append({"segment": rendered, "minutes": ""})
        return result
    if isinstance(value, dict):
        return [{"segment": key, "minutes": _stringify_lesson_pack_value(item)} for key, item in value.items() if _stringify_lesson_pack_value(item)]
    rendered = _stringify_lesson_pack_value(value)
    return [{"segment": rendered, "minutes": ""}] if rendered else []


def _normalize_lesson_pack_payload(payload: Dict[str, Any], course: Course) -> Dict[str, Any]:
    main_thread_value = payload.get("main_thread")
    if isinstance(main_thread_value, dict):
        main_thread_parts = []
        for key in ("narrative_arc", "core_question"):
            rendered = _stringify_lesson_pack_value(main_thread_value.get(key))
            if rendered:
                main_thread_parts.append(rendered)
        main_thread_parts.extend(
            _normalize_lesson_pack_list(main_thread_value.get("storyline_segments") or main_thread_value.get("three_acts"))[:4]
        )
        main_thread = "\n".join(_dedupe_text_parts(main_thread_parts))
    else:
        main_thread = _stringify_lesson_pack_value(main_thread_value)

    normalized = {
        "teaching_objectives": _normalize_lesson_pack_list(payload.get("teaching_objectives")),
        "prerequisites": _normalize_lesson_pack_list(payload.get("prerequisites")),
        "main_thread": main_thread or f"Build the lesson around {course.chapter or course.name}, then connect it to {course.frontier_direction or 'the frontier topic'}.",
        "frontier_topic": _normalize_frontier_topic(payload.get("frontier_topic"), course),
        "time_allocation": _normalize_time_allocation(payload.get("time_allocation")),
        "ppt_outline": _normalize_lesson_pack_list(payload.get("ppt_outline")),
        "teacher_tips": _normalize_lesson_pack_list(payload.get("teacher_tips")),
        "case_materials": _normalize_lesson_pack_list(payload.get("case_materials")),
        "discussion_questions": _normalize_lesson_pack_list(payload.get("discussion_questions")),
        "after_class_tasks": _normalize_lesson_pack_list(payload.get("after_class_tasks")),
        "extended_reading": _normalize_lesson_pack_list(payload.get("extended_reading")),
        "risk_warning": _normalize_lesson_pack_list(payload.get("risk_warning")),
        "references": _normalize_lesson_pack_list(payload.get("references")),
    }
    if not normalized["ppt_outline"] and isinstance(payload.get("ppt_outline"), dict):
        normalized["ppt_outline"] = _normalize_lesson_pack_list(payload["ppt_outline"].get("slides"))
    return normalized


def _build_lesson_pack_prompt(course: Course) -> str:
    return (
        "Generate a concise, directly parseable lesson-pack JSON for this course. "
        "Return JSON only. Do not use Markdown, explanations, or extra top-level fields. "
        'Use exactly this top-level schema: '
        '{"teaching_objectives":[...],"prerequisites":[...],"main_thread":"...",'
        '"frontier_topic":{"name":"...","insert_position":"...","time_suggestion":"..."},'
        '"time_allocation":[{"segment":"...","minutes":"...","activities":["..."]}],"ppt_outline":[...],'
        '"teacher_tips":[...],"case_materials":[...],"discussion_questions":[...],"after_class_tasks":[...],'
        '"extended_reading":[...],"risk_warning":[...],"references":[...]}. '
        "Keep each array to 3-6 short items. Keep the overall output within about 1800 Chinese characters.\n"
        f"Course name: {course.name}\n"
        f"Audience: {course.audience}\n"
        f"Student level: {course.student_level}\n"
        f"Current chapter: {course.chapter}\n"
        f"Learning goals: {course.objectives}\n"
        f"Duration: {course.duration_minutes} minutes\n"
        f"Frontier topic: {course.frontier_direction}"
    )


def _repair_lesson_pack_json(raw_content: str, course: Course) -> Optional[Dict[str, Any]]:
    repair_prompt = (
        "Rewrite the draft below into strict, parseable JSON. "
        "Return JSON only. Do not use Markdown, explanations, or extra fields. "
        "Keep only these top-level fields: teaching_objectives, prerequisites, main_thread, frontier_topic, "
        "time_allocation, ppt_outline, teacher_tips, case_materials, discussion_questions, "
        "after_class_tasks, extended_reading, risk_warning, references. "
        "If the draft is too long, compress it while preserving the teaching essentials.\n"
        f"Course name: {course.name}\n"
        f"Current chapter: {course.chapter}\n"
        f"Draft:\n{_truncate(raw_content, 9000)}"
    )
    repaired = _call_chat_model(
        [
            {"role": "system", "content": "You are a lesson-pack JSON repair tool. Return valid JSON only."},
            {"role": "user", "content": repair_prompt},
        ],
        model_key="default",
        max_tokens=2200,
        temperature=0.2,
    )
    if not repaired.get("success"):
        return None
    return _extract_json(str(repaired.get("content") or ""))

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
    prompt = _build_lesson_pack_prompt(course)
    call_result = _call_chat_model(
        [
            {"role": "system", "content": "你是一位高校教学设计顾问，只返回紧凑、合法、可解析的 JSON。"},
            {"role": "user", "content": prompt},
        ],
        model_key="default",
        max_tokens=2200,
        temperature=0.35,
    )
    payload = _extract_json(str(call_result.get("content") or "")) if call_result.get("success") else None
    if payload is None and call_result.get("success") and call_result.get("content"):
        payload = _repair_lesson_pack_json(str(call_result.get("content") or ""), course)
    if payload is None:
        from .mock_data import mock_generate_lesson_pack

        return mock_generate_lesson_pack(course)
    normalized_payload = _normalize_lesson_pack_payload(payload, course)
    return LessonPack(
        id=f"lp-{uuid.uuid4().hex[:8]}",
        course_id=course.id,
        version=1,
        status="draft",
        payload=normalized_payload,
        created_at=datetime_now(),
    )


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
