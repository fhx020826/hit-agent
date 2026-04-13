from __future__ import annotations

import json
import os
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from ..database import DBMaterialUpdateJob, MATERIAL_UPDATE_UPLOAD_DIR, get_db
from ..models.schemas import MaterialUpdatePreviewRequest, MaterialUpdateResult
from ..security import require_roles
from ..services.task_job_handlers import (
    preview_material_update_sync,
    upload_material_update_sync,
)

router = APIRouter(prefix="/api/material-update", tags=["material-update"])


@router.post("/preview", response_model=MaterialUpdateResult)
def preview_material_update(body: MaterialUpdatePreviewRequest, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    return preview_material_update_sync(db, teacher_id=current_user["id"], body=body)


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
    return upload_material_update_sync(
        db,
        teacher_id=current_user["id"],
        course_id=course_id,
        title=title,
        instructions=instructions,
        selected_model=selected_model,
        source_filename=file.filename or "",
        source_file_path=file_path,
    )


@router.get("", response_model=list[MaterialUpdateResult])
def list_material_updates(current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    rows = db.query(DBMaterialUpdateJob).filter(DBMaterialUpdateJob.teacher_id == current_user["id"]).order_by(DBMaterialUpdateJob.created_at.desc()).all()
    return [MaterialUpdateResult(id=row.id, title=row.title, summary=row.result_summary, update_suggestions=json.loads(row.result_outline or "[]"), draft_pages=json.loads(row.result_pages or "[]"), image_suggestions=json.loads(row.image_suggestions or "[]"), selected_model=row.selected_model or "default", used_model_name=row.used_model_name or "", model_status=row.model_status or "ok", created_at=row.created_at) for row in rows]
