from __future__ import annotations

import json
import os
from ast import literal_eval
from datetime import datetime
from typing import Any, Dict, List
from uuid import uuid4

from sqlalchemy.orm import Session

from ..database import DBCourse, DBLessonPack, DBMaterialUpdateJob, MATERIAL_UPDATE_UPLOAD_DIR
from ..db.models_tasks import DBTaskJob
from ..models.schemas import Course, LessonPack, MaterialUpdatePreviewRequest, MaterialUpdateResult
from .file_extractors import extract_text_from_file
from .llm_service import generate_lesson_pack as llm_generate_lesson_pack
from .llm_service import generate_material_update
from .pptx_export import SlideSpec, build_pptx_bytes
from .rag_service import upsert_chunks_for_lesson_pack

LESSON_PACK_GENERATE_JOB_TYPE = "lesson_pack.generate"
MATERIAL_UPDATE_PREVIEW_JOB_TYPE = "material_update.preview"
MATERIAL_UPDATE_UPLOAD_JOB_TYPE = "material_update.upload"


def _now() -> str:
    return datetime.now().isoformat()


def _model_dump(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    raise TypeError(f"不支持的模型类型：{type(value)!r}")


def _course_row_to_schema(row: DBCourse) -> Course:
    return Course(
        id=row.id,
        name=row.name,
        audience=row.audience,
        class_name=row.class_name,
        student_level=row.student_level,
        chapter=row.chapter,
        objectives=row.objectives,
        duration_minutes=row.duration_minutes,
        frontier_direction=row.frontier_direction,
        owner_user_id=row.owner_user_id or "",
        created_at=row.created_at,
    )


def _lesson_pack_row_to_schema(row: DBLessonPack) -> LessonPack:
    payload = json.loads(row.payload) if isinstance(row.payload, str) else row.payload
    return LessonPack(
        id=row.id,
        course_id=row.course_id,
        version=row.version,
        status=row.status,
        payload=payload,
        created_at=row.created_at,
    )


def _course_context_for_generation(course: DBCourse | None) -> str:
    if not course:
        return ""
    parts = [
        f"课程名称：{course.name}",
        f"授课对象：{course.audience or course.class_name or '未指定'}",
        f"学生水平：{course.student_level or '未指定'}",
        f"当前章节：{course.chapter or '未指定'}",
        f"课程目标：{course.objectives or '未指定'}",
        f"课时长度：{course.duration_minutes or 90} 分钟",
        f"前沿方向：{course.frontier_direction or '未指定'}",
    ]
    return "\n".join(parts)


def _decode_material_update_sections(value: str, primary_key: str, extra_keys: List[str]) -> Dict[str, List[str]]:
    fallback = {primary_key: [], **{key: [] for key in extra_keys}}
    try:
        parsed = json.loads(value or "[]")
    except Exception:
        return fallback
    if isinstance(parsed, list):
        fallback[primary_key] = [str(item) for item in parsed]
        return fallback
    if isinstance(parsed, dict):
        result = dict(fallback)
        for key in result:
            raw_items = parsed.get(key, [])
            if isinstance(raw_items, list):
                result[key] = [str(item) for item in raw_items]
        return result
    return fallback


def _decode_material_update_metadata(value: str) -> Dict[str, str]:
    fallback = {"generation_mode": "update_existing", "target_format": "ppt"}
    try:
        parsed = json.loads(value or "{}")
    except Exception:
        return fallback
    if not isinstance(parsed, dict):
        return fallback
    generation_mode = str(parsed.get("generation_mode") or fallback["generation_mode"]).strip() or fallback["generation_mode"]
    target_format = str(parsed.get("target_format") or fallback["target_format"]).strip() or fallback["target_format"]
    return {"generation_mode": generation_mode, "target_format": target_format}


def _encode_material_update_sections(
    primary_key: str,
    primary_items: List[str],
    extra_sections: Dict[str, List[str]],
    extra_metadata: Dict[str, str] | None = None,
) -> str:
    payload = {primary_key: list(primary_items)}
    for key, items in extra_sections.items():
        payload[key] = list(items)
    for key, value in (extra_metadata or {}).items():
        payload[key] = value
    return json.dumps(payload, ensure_ascii=False)


def _material_update_row_to_schema(row: DBMaterialUpdateJob) -> MaterialUpdateResult:
    metadata = _decode_material_update_metadata(row.result_outline or "{}")
    outline_sections = _decode_material_update_sections(
        row.result_outline or "[]",
        "update_suggestions",
        ["teaching_flow", "speaker_notes"],
    )
    page_sections = _decode_material_update_sections(
        row.result_pages or "[]",
        "draft_pages",
        ["classroom_interactions", "assessment_checkpoints"],
    )
    image_sections = _decode_material_update_sections(
        row.image_suggestions or "[]",
        "image_suggestions",
        ["delivery_checklist", "reference_updates"],
    )
    return MaterialUpdateResult(
        id=row.id,
        course_id=row.course_id or "",
        title=row.title,
        source_filename=row.source_filename or "",
        generation_mode=metadata["generation_mode"],
        target_format=metadata["target_format"],
        summary=row.result_summary,
        update_suggestions=outline_sections["update_suggestions"],
        draft_pages=page_sections["draft_pages"],
        image_suggestions=image_sections["image_suggestions"],
        teaching_flow=outline_sections["teaching_flow"],
        speaker_notes=outline_sections["speaker_notes"],
        classroom_interactions=page_sections["classroom_interactions"],
        assessment_checkpoints=page_sections["assessment_checkpoints"],
        delivery_checklist=image_sections["delivery_checklist"],
        reference_updates=image_sections["reference_updates"],
        selected_model=row.selected_model or "default",
        used_model_name=row.used_model_name or "",
        model_status=row.model_status or "ok",
        generated_file_name=row.generated_file_name or "",
        generated_file_type=row.generated_file_type or "",
        generated_download_url=f"/api/material-update/{row.id}/download" if row.generated_file_path else "",
        created_at=row.created_at,
    )


def persist_lesson_pack(db: Session, lesson_pack: LessonPack) -> LessonPack:
    row = DBLessonPack(
        id=lesson_pack.id,
        course_id=lesson_pack.course_id,
        version=lesson_pack.version,
        status=lesson_pack.status,
        payload=json.dumps(lesson_pack.payload, ensure_ascii=False),
        created_at=lesson_pack.created_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    try:
        upsert_chunks_for_lesson_pack(db, row)
        db.commit()
    except Exception:
        db.rollback()
    return _lesson_pack_row_to_schema(row)


def generate_lesson_pack_for_course(db: Session, course_id: str) -> LessonPack:
    course_row = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if not course_row:
        raise RuntimeError("课程不存在")
    lesson_pack = llm_generate_lesson_pack(_course_row_to_schema(course_row))
    lesson_pack.version = _next_lesson_pack_version(db, course_id)
    return persist_lesson_pack(db, lesson_pack)


def _next_lesson_pack_version(db: Session, course_id: str) -> int:
    latest_row = (
        db.query(DBLessonPack)
        .filter(DBLessonPack.course_id == course_id)
        .order_by(DBLessonPack.version.desc(), DBLessonPack.created_at.desc())
        .first()
    )
    return (latest_row.version if latest_row else 0) + 1


def create_material_update_record(
    db: Session,
    *,
    teacher_id: str,
    course_id: str,
    title: str,
    source_filename: str,
    source_file_path: str,
    instructions: str,
    result: dict[str, Any],
) -> MaterialUpdateResult:
    generated_file_name, generated_file_path, generated_file_type = _generate_output_asset(
        teacher_id=teacher_id,
        title=title,
        course_id=course_id,
        source_filename=source_filename,
        result=result,
    )
    row = DBMaterialUpdateJob(
        id=f"mu-{uuid4().hex[:8]}",
        teacher_id=teacher_id,
        course_id=course_id,
        title=title or "PPT / 教案更新",
        source_filename=source_filename,
        source_file_path=source_file_path,
        instructions=instructions,
        selected_model=result.get("selected_model") or "default",
        used_model_name=result.get("used_model_name", ""),
        model_status=result.get("model_status", "ok"),
        generated_file_name=generated_file_name,
        generated_file_path=generated_file_path,
        generated_file_type=generated_file_type,
        result_summary=result["summary"],
        result_outline=_encode_material_update_sections(
            "update_suggestions",
            [str(item) for item in result.get("update_suggestions", [])],
            {
                "teaching_flow": [str(item) for item in result.get("teaching_flow", [])],
                "speaker_notes": [str(item) for item in result.get("speaker_notes", [])],
            },
            {
                "generation_mode": str(result.get("generation_mode") or "update_existing"),
                "target_format": str(result.get("target_format") or "ppt"),
            },
        ),
        result_pages=_encode_material_update_sections(
            "draft_pages",
            [str(item) for item in result.get("draft_pages", [])],
            {
                "classroom_interactions": [str(item) for item in result.get("classroom_interactions", [])],
                "assessment_checkpoints": [str(item) for item in result.get("assessment_checkpoints", [])],
            },
        ),
        image_suggestions=_encode_material_update_sections(
            "image_suggestions",
            [str(item) for item in result.get("image_suggestions", [])],
            {
                "delivery_checklist": [str(item) for item in result.get("delivery_checklist", [])],
                "reference_updates": [str(item) for item in result.get("reference_updates", [])],
            },
        ),
        created_at=_now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _material_update_row_to_schema(row)


def _generate_output_asset(
    *,
    teacher_id: str,
    title: str,
    course_id: str,
    source_filename: str,
    result: dict[str, Any],
) -> tuple[str, str, str]:
    generation_mode = str(result.get("generation_mode") or "update_existing")
    target_format = str(result.get("target_format") or "ppt")
    if generation_mode != "generate_new" or target_format != "ppt":
        return "", "", ""

    slides = _build_slide_specs(result, title=title, course_id=course_id, source_filename=source_filename)
    display_name = f"{(title or 'PPT生成结果').strip() or 'PPT生成结果'}.pptx"
    teacher_dir = os.path.join(MATERIAL_UPDATE_UPLOAD_DIR, teacher_id, "generated")
    os.makedirs(teacher_dir, exist_ok=True)
    disk_name = f"{uuid4().hex[:12]}.pptx"
    disk_path = os.path.join(teacher_dir, disk_name)
    author = str(result.get("used_model_name") or result.get("selected_model") or "HIT Agent")
    pptx_bytes = build_pptx_bytes(title=title or "PPT生成结果", author=author, slides=slides)
    with open(disk_path, "wb") as file_obj:
        file_obj.write(pptx_bytes)
    return display_name, disk_path, "application/vnd.openxmlformats-officedocument.presentationml.presentation"


def _build_slide_specs(
    result: dict[str, Any],
    *,
    title: str,
    course_id: str,
    source_filename: str,
) -> list[SlideSpec]:
    safe_title = (title or "PPT生成结果").strip() or "PPT生成结果"
    subtitle_items = [
        f"主题：{safe_title}",
        f"课程编号：{course_id}" if course_id else "",
        str(result.get("summary") or "").strip(),
    ]
    slides: list[SlideSpec] = [SlideSpec(title=safe_title, bullets=[item for item in subtitle_items if item])]
    draft_pages = [str(item) for item in result.get("draft_pages", []) if str(item).strip()]
    for index, item in enumerate(draft_pages, start=1):
        slides.append(_draft_page_to_slide(item, index))

    if len(slides) == 1:
        fallback_items = [str(item) for item in result.get("update_suggestions", []) if str(item).strip()]
        if fallback_items:
            slides.append(SlideSpec(title="内容建议", bullets=fallback_items[:6]))
        teaching_flow = [str(item) for item in result.get("teaching_flow", []) if str(item).strip()]
        if teaching_flow:
            slides.append(SlideSpec(title="教学流程", bullets=teaching_flow[:6]))

    if source_filename:
        slides.append(SlideSpec(title="参考来源", bullets=[f"已参考上传文件：{source_filename}"]))
    return slides


def _draft_page_to_slide(raw_item: str, index: int) -> SlideSpec:
    parsed = _parse_structured_item(raw_item)
    if isinstance(parsed, dict):
        title = str(
            parsed.get("title")
            or parsed.get("page_title")
            or parsed.get("heading")
            or parsed.get("topic")
            or f"第 {index} 页"
        ).strip()
        bullets: list[str] = []
        for key in ("content", "sub_content", "points", "speaker_notes", "teaching_focus", "interaction"):
            bullets.extend(_coerce_text_list(parsed.get(key)))
        clean_bullets = [item for item in bullets if item]
        return SlideSpec(title=title or f"第 {index} 页", bullets=clean_bullets or [raw_item.strip()])
    cleaned = raw_item.strip()
    if "：" in cleaned:
        head, tail = cleaned.split("：", 1)
        if len(head) <= 18 and tail.strip():
            return SlideSpec(title=head.strip() or f"第 {index} 页", bullets=[tail.strip()])
    return SlideSpec(title=f"第 {index} 页", bullets=[cleaned or "暂无内容。"])


def _parse_structured_item(raw_item: str) -> Any:
    cleaned = raw_item.strip()
    if not cleaned:
        return None
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    try:
        return literal_eval(cleaned)
    except Exception:
        return None


def _coerce_text_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).strip()
    if not text:
        return []
    if "\n" in text:
        return [segment.strip(" -•") for segment in text.splitlines() if segment.strip(" -•")]
    if "；" in text:
        return [segment.strip() for segment in text.split("；") if segment.strip()]
    return [text]


def preview_material_update_sync(
    db: Session,
    *,
    teacher_id: str,
    body: MaterialUpdatePreviewRequest,
) -> MaterialUpdateResult:
    course = db.query(DBCourse).filter(DBCourse.id == body.course_id).first() if body.course_id else None
    result = generate_material_update(
        body.material_text,
        body.instructions,
        course.name if course else "",
        course_context=_course_context_for_generation(course),
        generation_mode=body.generation_mode,
        target_format=body.target_format,
        model_key=body.selected_model,
    )
    return create_material_update_record(
        db,
        teacher_id=teacher_id,
        course_id=body.course_id,
        title=body.title,
        source_filename="",
        source_file_path="",
        instructions=body.instructions,
        result=result,
    )


def upload_material_update_sync(
    db: Session,
    *,
    teacher_id: str,
    course_id: str,
    title: str,
    generation_mode: str,
    target_format: str,
    instructions: str,
    selected_model: str,
    source_filename: str,
    source_file_path: str,
) -> MaterialUpdateResult:
    file_type = os.path.splitext(source_filename or "")[1].lower()
    material_text, _ = extract_text_from_file(source_file_path, file_type)
    course = db.query(DBCourse).filter(DBCourse.id == course_id).first() if course_id else None
    result = generate_material_update(
        material_text,
        instructions,
        course.name if course else "",
        course_context=_course_context_for_generation(course),
        generation_mode=generation_mode,
        target_format=target_format,
        model_key=selected_model,
    )
    return create_material_update_record(
        db,
        teacher_id=teacher_id,
        course_id=course_id,
        title=title,
        source_filename=source_filename,
        source_file_path=source_file_path,
        instructions=instructions,
        result=result,
    )


def handle_lesson_pack_generate_job(db: Session, job: DBTaskJob, payload: dict[str, Any]) -> dict[str, Any]:
    lesson_pack = generate_lesson_pack_for_course(db, str(payload.get("course_id") or job.course_id or ""))
    return {
        "message": "课程包已生成，可继续发布或查看详情。",
        "lesson_pack": _model_dump(lesson_pack),
    }


def handle_material_update_preview_job(db: Session, job: DBTaskJob, payload: dict[str, Any]) -> dict[str, Any]:
    body = MaterialUpdatePreviewRequest(**payload)
    result = preview_material_update_sync(db, teacher_id=job.owner_user_id, body=body)
    message = "PPT 已生成，可直接下载。" if result.generation_mode == "generate_new" else "资料更新建议已生成。"
    return {
        "message": message,
        "material_update": _model_dump(result),
    }


def handle_material_update_upload_job(db: Session, job: DBTaskJob, payload: dict[str, Any]) -> dict[str, Any]:
    result = upload_material_update_sync(
        db,
        teacher_id=job.owner_user_id,
        course_id=str(payload.get("course_id") or ""),
        generation_mode=str(payload.get("generation_mode") or "update_existing"),
        target_format=str(payload.get("target_format") or "ppt"),
        title=str(payload.get("title") or "PPT / 教案更新"),
        instructions=str(payload.get("instructions") or ""),
        selected_model=str(payload.get("selected_model") or "default"),
        source_filename=str(payload.get("source_filename") or ""),
        source_file_path=str(payload.get("source_file_path") or ""),
    )
    message = "PPT 已生成，可直接下载。" if result.generation_mode == "generate_new" else "资料更新建议已生成。"
    return {
        "message": message,
        "material_update": _model_dump(result),
    }


TASK_JOB_HANDLERS = {
    LESSON_PACK_GENERATE_JOB_TYPE: handle_lesson_pack_generate_job,
    MATERIAL_UPDATE_PREVIEW_JOB_TYPE: handle_material_update_preview_job,
    MATERIAL_UPDATE_UPLOAD_JOB_TYPE: handle_material_update_upload_job,
}
