from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from ..database import DBCourse, DBCourseClass, DBDiscussionSpace, DBDiscussionSpaceMember, DBUser, DBUserProfile


def ensure_discussion_space_for_course_class(db: Session, *, course: DBCourse, class_name: str, teacher_user_id: str) -> DBDiscussionSpace | None:
    class_name = (class_name or "").strip()
    if not class_name:
        return None

    course_class = db.query(DBCourseClass).filter(DBCourseClass.course_id == course.id, DBCourseClass.class_name == class_name).first()
    if course_class and course_class.discussion_space_id:
        space = db.query(DBDiscussionSpace).filter(DBDiscussionSpace.id == course_class.discussion_space_id).first()
        if space:
            _ensure_space_members(db, space_id=space.id, class_name=class_name, teacher_user_id=teacher_user_id)
            return space

    space = DBDiscussionSpace(
        id=f"space-{uuid4().hex[:8]}",
        course_id=course.id,
        class_name=class_name,
        space_name=f"{course.name}-{class_name}讨论空间",
        ai_assistant_enabled=1,
        created_at=datetime.now().isoformat(),
    )
    db.add(space)
    db.flush()

    if not course_class:
        course_class = DBCourseClass(
            id=f"course-class-{uuid4().hex[:8]}",
            course_id=course.id,
            class_name=class_name,
            discussion_space_id=space.id,
            created_at=datetime.now().isoformat(),
        )
        db.add(course_class)
    else:
        course_class.discussion_space_id = space.id

    _ensure_space_members(db, space_id=space.id, class_name=class_name, teacher_user_id=teacher_user_id)
    return space


def ensure_discussion_spaces_for_all_courses(db: Session) -> None:
    courses = db.query(DBCourse).all()
    for course in courses:
        class_name = (course.class_name or course.audience or "").strip()
        if class_name and course.owner_user_id:
            ensure_discussion_space_for_course_class(db, course=course, class_name=class_name, teacher_user_id=course.owner_user_id)
    db.commit()


def _ensure_space_members(db: Session, *, space_id: str, class_name: str, teacher_user_id: str) -> None:
    if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == space_id, DBDiscussionSpaceMember.user_id == teacher_user_id).first():
        db.add(DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space_id, user_id=teacher_user_id, role_in_space="teacher", joined_at=datetime.now().isoformat()))

    student_profiles = db.query(DBUserProfile).filter(DBUserProfile.class_name == class_name).all()
    valid_student_ids = {profile.user_id for profile in student_profiles}
    students = db.query(DBUser).filter(DBUser.id.in_(valid_student_ids)).all() if valid_student_ids else []
    for student in students:
        if student.role != "student":
            continue
        if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == space_id, DBDiscussionSpaceMember.user_id == student.id).first():
            db.add(DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space_id, user_id=student.id, role_in_space="student", joined_at=datetime.now().isoformat()))

    if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == space_id, DBDiscussionSpaceMember.user_id == "ai-course-assistant").first():
        db.add(DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space_id, user_id="ai-course-assistant", role_in_space="ai", joined_at=datetime.now().isoformat()))
