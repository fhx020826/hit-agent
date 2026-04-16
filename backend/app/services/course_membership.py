from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..db.models import DBCourse, DBCourseClass, DBCourseMember, DBDiscussionSpace, DBUser


def generate_invite_code() -> str:
    return uuid4().hex[:8].upper()


def generate_invite_link(course_id: str, invite_code: str) -> str:
    return f"/student/courses?course_id={course_id}&code={invite_code}"


def list_course_class_rows(db: Session, course_id: str) -> list[DBCourseClass]:
    rows = db.query(DBCourseClass).filter(DBCourseClass.course_id == course_id).order_by(DBCourseClass.created_at.asc()).all()
    if rows:
        return rows
    course = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    primary_class = (course.class_name or course.audience or "").strip() if course else ""
    if not primary_class:
        return []
    created = ensure_course_class(
        db,
        course_id=course_id,
        class_name=primary_class,
        term=(course.term if course else ""),
    )
    return [created] if created else []


def ensure_course_class(db: Session, *, course_id: str, class_name: str, term: str = "") -> DBCourseClass | None:
    normalized = (class_name or "").strip()
    if not normalized:
        return None
    row = db.query(DBCourseClass).filter(DBCourseClass.course_id == course_id, DBCourseClass.class_name == normalized).first()
    if row:
        if term and not row.term:
            row.term = term
        if not row.invite_code:
            row.invite_code = generate_invite_code()
        if not row.invite_link_token:
            row.invite_link_token = uuid4().hex[:12]
        return row
    now = datetime.now().isoformat()
    row = DBCourseClass(
        id=f"course-class-{uuid4().hex[:8]}",
        course_id=course_id,
        class_name=normalized,
        term=term,
        discussion_space_id="",
        invite_code=generate_invite_code(),
        invite_link_token=uuid4().hex[:12],
        created_at=now,
    )
    db.add(row)
    db.flush()
    return row


def ensure_course_member(
    db: Session,
    *,
    course_id: str,
    user_id: str,
    role: str,
    class_name: str = "",
    source: str = "manual",
    status: str = "active",
) -> DBCourseMember:
    row = db.query(DBCourseMember).filter(DBCourseMember.course_id == course_id, DBCourseMember.user_id == user_id, DBCourseMember.role == role).first()
    normalized_class = (class_name or "").strip()
    if row:
        if normalized_class:
            row.class_name = normalized_class
        row.status = status
        if source:
            row.source = source
        if not row.joined_at:
            row.joined_at = datetime.now().isoformat()
        return row
    row = DBCourseMember(
        id=f"course-member-{uuid4().hex[:8]}",
        course_id=course_id,
        class_name=normalized_class,
        user_id=user_id,
        role=role,
        status=status,
        source=source,
        joined_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.flush()
    return row


def active_course_member(
    db: Session,
    *,
    course_id: str,
    user_id: str,
    role: str | None = None,
) -> DBCourseMember | None:
    query = db.query(DBCourseMember).filter(
        DBCourseMember.course_id == course_id,
        DBCourseMember.user_id == user_id,
        DBCourseMember.status == "active",
    )
    if role:
        query = query.filter(DBCourseMember.role == role)
    return query.order_by(DBCourseMember.joined_at.asc()).first()


def teacher_course_ids(current_user: dict, db: Session) -> list[str]:
    rows = db.query(DBCourse).filter(DBCourse.owner_user_id == current_user["id"]).order_by(DBCourse.created_at.desc()).all()
    return [row.id for row in rows]


def student_course_ids(current_user: dict, db: Session) -> list[str]:
    rows = (
        db.query(DBCourseMember)
        .filter(DBCourseMember.user_id == current_user["id"], DBCourseMember.role == "student", DBCourseMember.status == "active")
        .order_by(DBCourseMember.joined_at.desc())
        .all()
    )
    result: list[str] = []
    seen: set[str] = set()
    for row in rows:
        if row.course_id in seen:
            continue
        seen.add(row.course_id)
        result.append(row.course_id)
    return result


def student_course_class_names(current_user: dict, db: Session, course_id: str) -> list[str]:
    rows = (
        db.query(DBCourseMember)
        .filter(
            DBCourseMember.user_id == current_user["id"],
            DBCourseMember.course_id == course_id,
            DBCourseMember.role == "student",
            DBCourseMember.status == "active",
        )
        .all()
    )
    result: list[str] = []
    seen: set[str] = set()
    for row in rows:
        normalized = (row.class_name or "").strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


def ensure_teacher_course_access(course_id: str, current_user: dict, db: Session) -> DBCourse:
    course = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    if current_user["role"] != "admin" and course.owner_user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="当前账号无权管理该课程")
    return course


def ensure_student_course_access(course_id: str, current_user: dict, db: Session) -> DBCourse:
    course = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    if current_user["role"] == "admin":
        return course
    if current_user["role"] == "teacher" and course.owner_user_id == current_user["id"]:
        return course
    member = active_course_member(db, course_id=course_id, user_id=current_user["id"], role="student")
    if not member:
        raise HTTPException(status_code=403, detail="请先加入课程后再使用该功能")
    return course


def list_course_members(db: Session, course_id: str, *, role: str | None = None) -> list[DBCourseMember]:
    query = db.query(DBCourseMember).filter(DBCourseMember.course_id == course_id, DBCourseMember.status == "active")
    if role:
        query = query.filter(DBCourseMember.role == role)
    return query.order_by(DBCourseMember.joined_at.asc()).all()


def count_discussion_spaces(db: Session, course_id: str) -> int:
    return db.query(DBDiscussionSpace).filter(DBDiscussionSpace.course_id == course_id).count()


def member_display_name_map(db: Session, members: list[DBCourseMember]) -> dict[str, str]:
    user_ids = list({member.user_id for member in members})
    rows = db.query(DBUser).filter(DBUser.id.in_(user_ids)).all() if user_ids else []
    return {row.id: row.display_name or row.account for row in rows}
