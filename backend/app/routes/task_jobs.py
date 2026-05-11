from __future__ import annotations

import json
import os
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from ..database import DBCourse, DBTaskJob, MATERIAL_UPDATE_UPLOAD_DIR, get_db
from ..models.schemas import MaterialUpdatePreviewRequest, TaskJobItem
from ..security import get_current_user, require_roles
from ..services.task_job_handlers import (
    LESSON_PACK_GENERATE_JOB_TYPE,
    MATERIAL_UPDATE_PREVIEW_JOB_TYPE,
    MATERIAL_UPDATE_UPLOAD_JOB_TYPE,
)
from ..services.task_jobs import TaskJobService

router = APIRouter(prefix="/api/task-jobs", tags=["task-jobs"])


def _decode_result(raw: str) -> dict:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _db_to_job(row: DBTaskJob) -> TaskJobItem:
    return TaskJobItem(
        id=row.id,
        job_type=row.job_type,
        course_id=row.course_id or "",
        status=row.status,
        progress=row.progress or 0,
        message=row.message or "",
        error_message=row.error_message or "",
        result=_decode_result(row.result_json or "{}"),
        created_at=row.created_at,
        updated_at=row.updated_at,
        started_at=row.started_at or "",
        finished_at=row.finished_at or "",
    )


def get_task_job_service(request: Request) -> TaskJobService:
    task_jobs = getattr(request.app.state, "task_jobs", None)
    if task_jobs is None:
        raise HTTPException(status_code=503, detail="任务中心尚未就绪")
    return task_jobs


def _get_owned_job(db: Session, job_id: str, current_user: dict) -> DBTaskJob:
    row = db.query(DBTaskJob).filter(DBTaskJob.id == job_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    if current_user["role"] != "admin" and row.owner_user_id != current_user["id"]:
        raise HTTPException(status_code=404, detail="任务不存在")
    return row


@router.post("/lesson-pack-generate/{course_id}", response_model=TaskJobItem)
def create_lesson_pack_job(
    course_id: str,
    current_user: dict = Depends(require_roles("teacher")),
    db: Session = Depends(get_db),
    task_jobs: TaskJobService = Depends(get_task_job_service),
):
    course = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    row = task_jobs.create_job(
        db,
        job_type=LESSON_PACK_GENERATE_JOB_TYPE,
        owner_user_id=current_user["id"],
        owner_role=current_user["role"],
        course_id=course_id,
        input_payload={"course_id": course_id},
        message="课程包生成任务已进入队列。",
    )
    return _db_to_job(row)


@router.post("/material-update/preview", response_model=TaskJobItem)
def create_material_update_preview_job(
    body: MaterialUpdatePreviewRequest,
    current_user: dict = Depends(require_roles("teacher")),
    db: Session = Depends(get_db),
    task_jobs: TaskJobService = Depends(get_task_job_service),
):
    payload = body.model_dump() if hasattr(body, "model_dump") else body.dict()
    row = task_jobs.create_job(
        db,
        job_type=MATERIAL_UPDATE_PREVIEW_JOB_TYPE,
        owner_user_id=current_user["id"],
        owner_role=current_user["role"],
        course_id=body.course_id,
        input_payload=payload,
        message="资料更新预览任务已进入队列。",
    )
    return _db_to_job(row)


@router.post("/material-update/upload", response_model=TaskJobItem)
def create_material_update_upload_job(
    course_id: str = Form(default=""),
    generation_mode: str = Form(default="update_existing"),
    target_format: str = Form(default="ppt"),
    title: str = Form(default="PPT / 教案更新"),
    instructions: str = Form(default=""),
    selected_model: str = Form(default="default"),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles("teacher")),
    db: Session = Depends(get_db),
    task_jobs: TaskJobService = Depends(get_task_job_service),
):
    teacher_dir = os.path.join(MATERIAL_UPDATE_UPLOAD_DIR, current_user["id"])
    os.makedirs(teacher_dir, exist_ok=True)
    file_id = uuid4().hex[:8]
    file_path = os.path.join(teacher_dir, f"{file_id}_{file.filename}")
    content = file.file.read()
    with open(file_path, "wb") as output:
        output.write(content)

    row = task_jobs.create_job(
        db,
        job_type=MATERIAL_UPDATE_UPLOAD_JOB_TYPE,
        owner_user_id=current_user["id"],
        owner_role=current_user["role"],
        course_id=course_id,
        input_payload={
            "course_id": course_id,
            "generation_mode": generation_mode,
            "target_format": target_format,
            "title": title,
            "instructions": instructions,
            "selected_model": selected_model,
            "source_filename": file.filename or "",
            "source_file_path": file_path,
        },
        message="资料更新上传任务已进入队列。",
    )
    return _db_to_job(row)


@router.get("/{job_id}", response_model=TaskJobItem)
def get_task_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _db_to_job(_get_owned_job(db, job_id, current_user))


@router.get("", response_model=list[TaskJobItem])
def list_task_jobs(
    job_type: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(DBTaskJob)
    if current_user["role"] != "admin":
        query = query.filter(DBTaskJob.owner_user_id == current_user["id"])
    if job_type:
        query = query.filter(DBTaskJob.job_type == job_type)
    rows = query.order_by(DBTaskJob.created_at.desc()).limit(max(1, min(limit, 100))).all()
    return [_db_to_job(row) for row in rows]
