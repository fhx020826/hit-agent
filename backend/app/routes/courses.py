"""课程相关路由：创建课程、获取课程列表、获取单个课程。"""

from __future__ import annotations

from typing import List, Dict

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..models.schemas import Course, CourseCreate
from ..database import get_db, DBCourse, init_db

router = APIRouter(prefix="/api/courses", tags=["courses"])


def _db_to_course(row: DBCourse) -> Course:
    return Course(
        id=row.id, name=row.name, audience=row.audience,
        student_level=row.student_level, chapter=row.chapter,
        objectives=row.objectives, duration_minutes=row.duration_minutes,
        frontier_direction=row.frontier_direction, created_at=row.created_at,
    )


@router.post("", response_model=Course)
def create_course(body: CourseCreate, db: Session = Depends(get_db)):
    """创建课程画像。"""
    import uuid
    from datetime import datetime
    course_id = f"course-{uuid.uuid4().hex[:8]}"
    row = DBCourse(
        id=course_id, name=body.name, audience=body.audience,
        student_level=body.student_level, chapter=body.chapter,
        objectives=body.objectives, duration_minutes=body.duration_minutes,
        frontier_direction=body.frontier_direction,
        created_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _db_to_course(row)


@router.get("", response_model=List[Course])
def list_courses(db: Session = Depends(get_db)):
    """获取所有课程。"""
    return [_db_to_course(r) for r in db.query(DBCourse).all()]


@router.get("/{course_id}", response_model=Course)
def get_course(course_id: str, db: Session = Depends(get_db)):
    """获取单个课程。"""
    row = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课程不存在")
    return _db_to_course(row)
