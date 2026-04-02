"""课时包相关路由：生成、查看、编辑、发布课时包。"""

from __future__ import annotations

import json
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..models.schemas import LessonPack, LessonPackUpdate
from ..database import get_db, DBLessonPack, DBCourse
from ..services.mock_data import mock_generate_lesson_pack

router = APIRouter(prefix="/api/lesson-packs", tags=["lesson-packs"])


def _db_to_lp(row: DBLessonPack) -> LessonPack:
    payload = json.loads(row.payload) if isinstance(row.payload, str) else row.payload
    return LessonPack(
        id=row.id, course_id=row.course_id, version=row.version,
        status=row.status, payload=payload, created_at=row.created_at,
    )


@router.post("/generate/{course_id}", response_model=LessonPack)
def generate_lesson_pack(course_id: str, db: Session = Depends(get_db)):
    """根据课程画像生成课时包。"""
    from ..models.schemas import Course
    row = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课程不存在")
    course = Course(
        id=row.id, name=row.name, audience=row.audience,
        student_level=row.student_level, chapter=row.chapter,
        objectives=row.objectives, duration_minutes=row.duration_minutes,
        frontier_direction=row.frontier_direction, created_at=row.created_at,
    )
    lp = mock_generate_lesson_pack(course)
    db_lp = DBLessonPack(
        id=lp.id, course_id=lp.course_id, version=lp.version,
        status=lp.status, payload=json.dumps(lp.payload, ensure_ascii=False),
        created_at=lp.created_at.isoformat() if hasattr(lp.created_at, "isoformat") else str(lp.created_at),
    )
    db.add(db_lp)
    db.commit()
    db.refresh(db_lp)
    return _db_to_lp(db_lp)


@router.get("", response_model=List[LessonPack])
def list_lesson_packs(course_id: Optional[str] = None, db: Session = Depends(get_db)):
    """获取课时包列表，可按课程过滤。"""
    q = db.query(DBLessonPack)
    if course_id:
        q = q.filter(DBLessonPack.course_id == course_id)
    return [_db_to_lp(r) for r in q.all()]


@router.get("/{lp_id}", response_model=LessonPack)
def get_lesson_pack(lp_id: str, db: Session = Depends(get_db)):
    """获取单个课时包。"""
    row = db.query(DBLessonPack).filter(DBLessonPack.id == lp_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课时包不存在")
    return _db_to_lp(row)


@router.put("/{lp_id}", response_model=LessonPack)
def update_lesson_pack(lp_id: str, body: LessonPackUpdate, db: Session = Depends(get_db)):
    """编辑课时包内容或状态。"""
    row = db.query(DBLessonPack).filter(DBLessonPack.id == lp_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课时包不存在")
    if body.payload is not None:
        row.payload = json.dumps(body.payload, ensure_ascii=False)
    if body.status is not None:
        row.status = body.status
    db.commit()
    db.refresh(row)
    return _db_to_lp(row)


@router.post("/{lp_id}/publish", response_model=LessonPack)
def publish_lesson_pack(lp_id: str, db: Session = Depends(get_db)):
    """发布课时包到学生端。"""
    row = db.query(DBLessonPack).filter(DBLessonPack.id == lp_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课时包不存在")
    row.status = "published"
    db.commit()
    db.refresh(row)
    return _db_to_lp(row)
