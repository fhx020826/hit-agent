from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import DBCourse, get_db
from ..models.schemas import Course, CourseCreate
from ..security import get_current_user, require_roles
from ..services.discussion_service import ensure_discussion_space_for_course_class

router = APIRouter(prefix="/api/courses", tags=["courses"])


def _db_to_course(row: DBCourse) -> Course:
    return Course(
        id=row.id,
        name=row.name,
        audience=row.audience,
        class_name=row.class_name or "",
        student_level=row.student_level,
        chapter=row.chapter,
        objectives=row.objectives,
        duration_minutes=row.duration_minutes,
        frontier_direction=row.frontier_direction,
        owner_user_id=row.owner_user_id or "",
        created_at=row.created_at,
    )


@router.post("", response_model=Course)
def create_course(body: CourseCreate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    row = DBCourse(
        id=f"course-{uuid4().hex[:8]}",
        name=body.name,
        audience=body.audience,
        class_name=body.class_name or body.audience,
        student_level=body.student_level,
        chapter=body.chapter,
        objectives=body.objectives,
        duration_minutes=body.duration_minutes,
        frontier_direction=body.frontier_direction,
        owner_user_id=current_user["id"],
        created_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.flush()
    target_class = body.class_name or body.audience
    if target_class:
        ensure_discussion_space_for_course_class(db, course=row, class_name=target_class, teacher_user_id=current_user["id"])
    db.commit()
    db.refresh(row)
    return _db_to_course(row)


@router.get("", response_model=list[Course])
def list_courses(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(DBCourse).order_by(DBCourse.created_at.desc()).all()
    return [_db_to_course(row) for row in rows]


@router.get("/{course_id}", response_model=Course)
def get_course(course_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课程不存在")
    return _db_to_course(row)
