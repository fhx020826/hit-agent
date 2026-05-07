from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..database import DBCourseEnrollment, DBCourseOffering


def get_teacher_offerings(db: Session, teacher_user_id: str) -> list[DBCourseOffering]:
    return db.query(DBCourseOffering).filter(DBCourseOffering.teacher_user_id == teacher_user_id, DBCourseOffering.status == "active").all()


def get_student_offerings(db: Session, student_user_id: str) -> list[DBCourseOffering]:
    enrollments = db.query(DBCourseEnrollment).filter(DBCourseEnrollment.student_user_id == student_user_id, DBCourseEnrollment.status == "active").all()
    offering_ids = [row.offering_id for row in enrollments]
    if not offering_ids:
        return []
    return db.query(DBCourseOffering).filter(DBCourseOffering.id.in_(offering_ids), DBCourseOffering.status == "active").all()


def assert_teacher_can_manage_offering(db: Session, teacher_user_id: str, offering_id: str) -> DBCourseOffering:
    row = db.query(DBCourseOffering).filter(DBCourseOffering.id == offering_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="开课关系不存在")
    if row.teacher_user_id != teacher_user_id:
        raise HTTPException(status_code=403, detail="无权管理该开课关系")
    return row


def assert_student_enrolled(db: Session, student_user_id: str, offering_id: str) -> None:
    row = db.query(DBCourseEnrollment).filter(
        DBCourseEnrollment.offering_id == offering_id,
        DBCourseEnrollment.student_user_id == student_user_id,
        DBCourseEnrollment.status == "active",
    ).first()
    if not row:
        raise HTTPException(status_code=403, detail="请先加入课程")


def assert_course_relation_exists(db: Session, course_id: str, class_id: str, teacher_user_id: str | None = None) -> bool:
    query = db.query(DBCourseOffering).filter(
        DBCourseOffering.course_id == course_id,
        DBCourseOffering.class_id == class_id,
        DBCourseOffering.status == "active",
    )
    if teacher_user_id:
        query = query.filter(DBCourseOffering.teacher_user_id == teacher_user_id)
    return query.first() is not None


def resolve_offering_context(
    db: Session,
    course_id: str | None = None,
    offering_id: str | None = None,
    class_name: str | None = None,
    user: dict | None = None,
) -> DBCourseOffering | None:
    if offering_id:
        return db.query(DBCourseOffering).filter(DBCourseOffering.id == offering_id).first()
    if course_id:
        query = db.query(DBCourseOffering).filter(DBCourseOffering.course_id == course_id, DBCourseOffering.status == "active")
        if user and user.get("role") == "teacher":
            query = query.filter(DBCourseOffering.teacher_user_id == user["id"])
        return query.first()
    return None
