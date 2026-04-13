from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from ..database import DBCourse, DBLessonPack, DBMaterialUpdateJob
from ..db.models_tasks import DBTaskJob
from ..models.schemas import Course, LessonPack, MaterialUpdatePreviewRequest, MaterialUpdateResult
from .file_extractors import extract_text_from_file
from .llm_service import generate_lesson_pack as llm_generate_lesson_pack
from .llm_service import generate_material_update
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


def _material_update_row_to_schema(row: DBMaterialUpdateJob) -> MaterialUpdateResult:
    return MaterialUpdateResult(
        id=row.id,
        title=row.title,
        summary=row.result_summary,
        update_suggestions=json.loads(row.result_outline or "[]"),
        draft_pages=json.loads(row.result_pages or "[]"),
        image_suggestions=json.loads(row.image_suggestions or "[]"),
        selected_model=row.selected_model or "default",
        used_model_name=row.used_model_name or "",
        model_status=row.model_status or "ok",
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
    return persist_lesson_pack(db, lesson_pack)


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
        result_summary=result["summary"],
        result_outline=json.dumps(result["update_suggestions"], ensure_ascii=False),
        result_pages=json.dumps(result["draft_pages"], ensure_ascii=False),
        image_suggestions=json.dumps(result["image_suggestions"], ensure_ascii=False),
        created_at=_now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _material_update_row_to_schema(row)


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
    return {
        "message": "资料更新建议已生成。",
        "material_update": _model_dump(result),
    }


def handle_material_update_upload_job(db: Session, job: DBTaskJob, payload: dict[str, Any]) -> dict[str, Any]:
    result = upload_material_update_sync(
        db,
        teacher_id=job.owner_user_id,
        course_id=str(payload.get("course_id") or ""),
        title=str(payload.get("title") or "PPT / 教案更新"),
        instructions=str(payload.get("instructions") or ""),
        selected_model=str(payload.get("selected_model") or "default"),
        source_filename=str(payload.get("source_filename") or ""),
        source_file_path=str(payload.get("source_file_path") or ""),
    )
    return {
        "message": "资料更新建议已生成。",
        "material_update": _model_dump(result),
    }


TASK_JOB_HANDLERS = {
    LESSON_PACK_GENERATE_JOB_TYPE: handle_lesson_pack_generate_job,
    MATERIAL_UPDATE_PREVIEW_JOB_TYPE: handle_material_update_preview_job,
    MATERIAL_UPDATE_UPLOAD_JOB_TYPE: handle_material_update_upload_job,
}
