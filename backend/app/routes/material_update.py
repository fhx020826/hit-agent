from __future__ import annotations

import json
import os
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import DBMaterialUpdateJob, MATERIAL_UPDATE_UPLOAD_DIR, get_db
from ..models.schemas import MaterialUpdatePreviewRequest, MaterialUpdateResult
from ..security import require_roles
from ..services.task_job_handlers import (
    _material_update_row_to_schema,
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
    generation_mode: str = Form(default="update_existing"),
    target_format: str = Form(default="ppt"),
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
        generation_mode=generation_mode,
        target_format=target_format,
        instructions=instructions,
        selected_model=selected_model,
        source_filename=file.filename or "",
        source_file_path=file_path,
    )


@router.get("", response_model=list[MaterialUpdateResult])
def list_material_updates(current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    rows = db.query(DBMaterialUpdateJob).filter(DBMaterialUpdateJob.teacher_id == current_user["id"]).order_by(DBMaterialUpdateJob.created_at.desc()).all()
    return [_material_update_row_to_schema(row) for row in rows]


@router.get("/{update_id}/download")
def download_generated_material_update(
    update_id: str,
    current_user: dict = Depends(require_roles("teacher")),
    db: Session = Depends(get_db),
):
    row = (
        db.query(DBMaterialUpdateJob)
        .filter(DBMaterialUpdateJob.id == update_id, DBMaterialUpdateJob.teacher_id == current_user["id"])
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Material update record not found")
    if not row.generated_file_path or not os.path.exists(row.generated_file_path):
        raise HTTPException(status_code=404, detail="Generated file not found")

    download_name = row.generated_file_name or f"{row.title or 'generated-ppt'}.pptx"
    fallback_name = f"{row.id}.pptx"
    content_disposition = (
        f'attachment; filename="{fallback_name}"; '
        f"filename*=UTF-8''{quote(download_name)}"
    )
    return FileResponse(
        row.generated_file_path,
        media_type=row.generated_file_type or "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": content_disposition},
    )


def _remove_owned_file(file_path: str) -> None:
    if not file_path:
        return
    try:
        base_dir = os.path.realpath(MATERIAL_UPDATE_UPLOAD_DIR)
        target = os.path.realpath(file_path)
        if os.path.commonpath([base_dir, target]) != base_dir:
            return
        if os.path.exists(target):
            os.remove(target)
    except Exception:
        return


@router.delete("/{update_id}")
def delete_material_update(
    update_id: str,
    current_user: dict = Depends(require_roles("teacher")),
    db: Session = Depends(get_db),
):
    row = (
        db.query(DBMaterialUpdateJob)
        .filter(DBMaterialUpdateJob.id == update_id, DBMaterialUpdateJob.teacher_id == current_user["id"])
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Material update record not found")

    source_path = row.source_file_path or ""
    generated_path = row.generated_file_path or ""
    db.delete(row)
    db.commit()

    _remove_owned_file(source_path)
    _remove_owned_file(generated_path)
    return {"status": "deleted", "message": "Material update record deleted"}
