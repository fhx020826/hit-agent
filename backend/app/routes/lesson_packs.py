from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import DBCourse, DBLessonPack, get_db
from ..models.schemas import Course, LessonPack, LessonPackUpdate
from ..security import get_current_user, require_roles
from ..services.task_job_handlers import generate_lesson_pack_for_course
from ..services.rag_service import upsert_chunks_for_lesson_pack

router = APIRouter(prefix="/api/lesson-packs", tags=["lesson-packs"])


def _db_to_lp(row: DBLessonPack) -> LessonPack:
    payload = json.loads(row.payload) if isinstance(row.payload, str) else row.payload
    return LessonPack(id=row.id, course_id=row.course_id, version=row.version, status=row.status, payload=payload, created_at=row.created_at)


@router.post("/generate/{course_id}", response_model=LessonPack)
def generate_lesson_pack(course_id: str, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    row = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课程不存在")
    return generate_lesson_pack_for_course(db, row.id)


@router.get("", response_model=list[LessonPack])
def list_lesson_packs(course_id: Optional[str] = None, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(DBLessonPack)
    if course_id:
        query = query.filter(DBLessonPack.course_id == course_id)
    rows = query.order_by(DBLessonPack.created_at.desc()).all()
    return [_db_to_lp(row) for row in rows]


@router.get("/{lp_id}", response_model=LessonPack)
def get_lesson_pack(lp_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(DBLessonPack).filter(DBLessonPack.id == lp_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课程包不存在")
    return _db_to_lp(row)


@router.put("/{lp_id}", response_model=LessonPack)
def update_lesson_pack(lp_id: str, body: LessonPackUpdate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    row = db.query(DBLessonPack).filter(DBLessonPack.id == lp_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课程包不存在")
    if body.payload is not None:
        row.payload = json.dumps(body.payload, ensure_ascii=False)
    if body.status is not None:
        row.status = body.status
    db.commit()
    db.refresh(row)
    return _db_to_lp(row)


@router.post("/{lp_id}/publish", response_model=LessonPack)
def publish_lesson_pack(lp_id: str, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    row = db.query(DBLessonPack).filter(DBLessonPack.id == lp_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课程包不存在")
    row.status = "published"
    db.commit()
    db.refresh(row)
    try:
        upsert_chunks_for_lesson_pack(db, row)
        db.commit()
    except Exception:
        db.rollback()
    return _db_to_lp(row)
