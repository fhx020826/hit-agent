from __future__ import annotations

import json
import os
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import DBCourse, DBMaterialUpdateJob, MATERIAL_UPDATE_UPLOAD_DIR, get_db
from ..models.schemas import MaterialUpdatePreviewRequest, MaterialUpdateResult
from ..security import require_roles
from ..services.llm_service import extract_text_from_file, generate_material_update

router = APIRouter(prefix="/api/material-update", tags=["material-update"])


@router.post("/preview", response_model=MaterialUpdateResult)
def preview_material_update(body: MaterialUpdatePreviewRequest, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    course = db.query(DBCourse).filter(DBCourse.id == body.course_id).first() if body.course_id else None
    result = generate_material_update(body.material_text, body.instructions, course.name if course else "", model_key=body.selected_model)
    row = DBMaterialUpdateJob(
        id=f"mu-{uuid4().hex[:8]}",
        teacher_id=current_user["id"],
        course_id=body.course_id,
        title=body.title,
        source_filename="",
        source_file_path="",
        instructions=body.instructions,
        selected_model=result.get("selected_model") or body.selected_model,
        used_model_name=result.get("used_model_name", ""),
        model_status=result.get("model_status", "ok"),
        result_summary=result["summary"],
        result_outline=json.dumps(result["update_suggestions"], ensure_ascii=False),
        result_pages=json.dumps(result["draft_pages"], ensure_ascii=False),
        image_suggestions=json.dumps(result["image_suggestions"], ensure_ascii=False),
        created_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.commit()
    return MaterialUpdateResult(id=row.id, title=row.title, summary=row.result_summary, update_suggestions=json.loads(row.result_outline), draft_pages=json.loads(row.result_pages), image_suggestions=json.loads(row.image_suggestions), selected_model=row.selected_model, used_model_name=row.used_model_name, model_status=row.model_status, created_at=row.created_at)


@router.post("/upload", response_model=MaterialUpdateResult)
def upload_material_for_update(
    course_id: str = Form(default=""),
    title: str = Form(default="PPT / 教案更新"),
    instructions: str = Form(default=""),
    selected_model: str = Form(default="default"),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles("teacher")),
    db: Session = Depends(get_db),
):
    teacher_dir = os.path.join(MATERIAL_UPDATE_UPLOAD_DIR, current_user["id"])
    os.makedirs(teacher_dir, exist_ok=True)
    file_id = uuid4().hex[:8]
    file_path = os.path.join(teacher_dir, f"{file_id}_{file.filename}")
    content = file.file.read()
    with open(file_path, "wb") as output:
        output.write(content)
    file_type = os.path.splitext(file.filename or "")[1].lower()
    material_text, _ = extract_text_from_file(file_path, file_type)
    course = db.query(DBCourse).filter(DBCourse.id == course_id).first() if course_id else None
    result = generate_material_update(material_text, instructions, course.name if course else "", model_key=selected_model)
    row = DBMaterialUpdateJob(
        id=f"mu-{uuid4().hex[:8]}",
        teacher_id=current_user["id"],
        course_id=course_id,
        title=title,
        source_filename=file.filename or "",
        source_file_path=file_path,
        instructions=instructions,
        selected_model=result.get("selected_model") or selected_model,
        used_model_name=result.get("used_model_name", ""),
        model_status=result.get("model_status", "ok"),
        result_summary=result["summary"],
        result_outline=json.dumps(result["update_suggestions"], ensure_ascii=False),
        result_pages=json.dumps(result["draft_pages"], ensure_ascii=False),
        image_suggestions=json.dumps(result["image_suggestions"], ensure_ascii=False),
        created_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.commit()
    return MaterialUpdateResult(id=row.id, title=row.title, summary=row.result_summary, update_suggestions=json.loads(row.result_outline), draft_pages=json.loads(row.result_pages), image_suggestions=json.loads(row.image_suggestions), selected_model=row.selected_model, used_model_name=row.used_model_name, model_status=row.model_status, created_at=row.created_at)


@router.get("", response_model=list[MaterialUpdateResult])
def list_material_updates(current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    rows = db.query(DBMaterialUpdateJob).filter(DBMaterialUpdateJob.teacher_id == current_user["id"]).order_by(DBMaterialUpdateJob.created_at.desc()).all()
    return [MaterialUpdateResult(id=row.id, title=row.title, summary=row.result_summary, update_suggestions=json.loads(row.result_outline or "[]"), draft_pages=json.loads(row.result_pages or "[]"), image_suggestions=json.loads(row.image_suggestions or "[]"), selected_model=row.selected_model or "default", used_model_name=row.used_model_name or "", model_status=row.model_status or "ok", created_at=row.created_at) for row in rows]

