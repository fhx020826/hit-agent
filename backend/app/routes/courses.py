from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import DBCourse, DBCourseClass, get_db
from ..models.schemas import (
    Course,
    CourseCatalogItem,
    CourseClassBinding,
    CourseClassCreate,
    CourseCreate,
    CourseJoinRequest,
    CourseMemberSummary,
    TeacherCourseManagementDetail,
)
from ..security import get_current_user, require_roles
from ..services.course_membership import (
    count_discussion_spaces,
    ensure_course_class,
    ensure_course_member,
    ensure_student_course_access,
    ensure_teacher_course_access,
    generate_invite_code,
    generate_invite_link,
    list_course_class_rows,
    list_course_members,
    member_display_name_map,
    student_course_ids,
    teacher_course_ids,
)
from ..services.discussion_service import ensure_discussion_space_for_course_class

router = APIRouter(prefix="/api/courses", tags=["courses"])


def _course_class_binding(row: DBCourseClass) -> CourseClassBinding:
    return CourseClassBinding(
        id=row.id,
        course_id=row.course_id,
        class_name=row.class_name,
        term=row.term or "",
        discussion_space_id=row.discussion_space_id or "",
        invite_code=row.invite_code or "",
        invite_link=generate_invite_link(row.course_id, row.invite_code or ""),
    )


def _course_to_schema(row: DBCourse, db: Session, *, joined: bool = False) -> Course:
    owner_name = ""
    if row.owner_user_id:
        from ..database import DBUser

        owner = db.query(DBUser).filter(DBUser.id == row.owner_user_id).first()
        owner_name = owner.display_name if owner else ""
    classes = list_course_class_rows(db, row.id)
    members = list_course_members(db, row.id)
    student_count = len([item for item in members if item.role == "student"])
    return Course(
        id=row.id,
        name=row.name,
        audience=row.audience,
        class_name=row.class_name or "",
        term=row.term or "",
        student_level=row.student_level,
        chapter=row.chapter,
        objectives=row.objectives,
        duration_minutes=row.duration_minutes,
        frontier_direction=row.frontier_direction,
        owner_user_id=row.owner_user_id or "",
        invite_code=row.invite_code or "",
        teacher_name=owner_name,
        discussion_space_count=count_discussion_spaces(db, row.id),
        bound_classes=[_course_class_binding(item) for item in classes],
        member_count=len(members),
        student_count=student_count,
        joined=joined,
        created_at=row.created_at,
    )


def _course_management_detail(row: DBCourse, db: Session) -> TeacherCourseManagementDetail:
    members = list_course_members(db, row.id)
    display_name_map = member_display_name_map(db, members)
    payload = _course_to_schema(row, db, joined=False).model_dump()
    payload["members"] = [
        CourseMemberSummary(
            user_id=item.user_id,
            display_name=display_name_map.get(item.user_id, item.user_id),
            role=item.role,
            class_name=item.class_name or "",
            status=item.status,
            joined_at=item.joined_at or "",
        )
        for item in members
    ]
    return TeacherCourseManagementDetail(**payload)


@router.post("", response_model=TeacherCourseManagementDetail)
def create_course(body: CourseCreate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    invite_code = generate_invite_code()
    row = DBCourse(
        id=f"course-{uuid4().hex[:8]}",
        name=body.name,
        audience=body.audience,
        class_name=body.class_name or body.audience,
        term=body.term,
        student_level=body.student_level,
        chapter=body.chapter,
        objectives=body.objectives,
        duration_minutes=body.duration_minutes,
        frontier_direction=body.frontier_direction,
        owner_user_id=current_user["id"],
        invite_code=invite_code,
        created_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.flush()
    ensure_course_member(db, course_id=row.id, user_id=current_user["id"], role="teacher", source="owner")
    target_class = body.class_name or body.audience
    if target_class:
        course_class = ensure_course_class(db, course_id=row.id, class_name=target_class, term=body.term)
        if course_class:
            course_class.invite_code = invite_code
            ensure_discussion_space_for_course_class(db, course=row, class_name=target_class, teacher_user_id=current_user["id"])
    db.commit()
    db.refresh(row)
    return _course_management_detail(row, db)


@router.get("", response_model=list[Course])
def list_courses(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user["role"] == "admin":
        rows = db.query(DBCourse).order_by(DBCourse.created_at.desc()).all()
        return [_course_to_schema(row, db, joined=False) for row in rows]
    if current_user["role"] == "teacher":
        ids = teacher_course_ids(current_user, db)
        rows = db.query(DBCourse).filter(DBCourse.id.in_(ids)).order_by(DBCourse.created_at.desc()).all() if ids else []
        return [_course_to_schema(row, db, joined=False) for row in rows]
    ids = student_course_ids(current_user, db)
    rows = db.query(DBCourse).filter(DBCourse.id.in_(ids)).order_by(DBCourse.created_at.desc()).all() if ids else []
    return [_course_to_schema(row, db, joined=True) for row in rows]


@router.get("/teacher/manage", response_model=list[TeacherCourseManagementDetail])
def list_teacher_courses(current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    ids = teacher_course_ids(current_user, db)
    rows = db.query(DBCourse).filter(DBCourse.id.in_(ids)).order_by(DBCourse.created_at.desc()).all() if ids else []
    return [_course_management_detail(row, db) for row in rows]


@router.post("/{course_id}/classes", response_model=TeacherCourseManagementDetail)
def bind_course_class(
    course_id: str,
    body: CourseClassCreate,
    current_user: dict = Depends(require_roles("teacher")),
    db: Session = Depends(get_db),
):
    course = ensure_teacher_course_access(course_id, current_user, db)
    course_class = ensure_course_class(db, course_id=course_id, class_name=body.class_name, term=body.term or course.term or "")
    if not course_class:
        raise HTTPException(status_code=400, detail="请填写班级名称")
    if not course.class_name:
        course.class_name = course_class.class_name
    if not course.term and body.term:
        course.term = body.term
    ensure_discussion_space_for_course_class(db, course=course, class_name=course_class.class_name, teacher_user_id=current_user["id"])
    db.commit()
    db.refresh(course)
    return _course_management_detail(course, db)


@router.post("/{course_id}/invite-code/regenerate", response_model=TeacherCourseManagementDetail)
def regenerate_invite_code(course_id: str, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    course = ensure_teacher_course_access(course_id, current_user, db)
    course.invite_code = generate_invite_code()
    for row in list_course_class_rows(db, course_id):
        row.invite_code = course.invite_code
    db.commit()
    db.refresh(course)
    return _course_management_detail(course, db)


@router.get("/student/catalog", response_model=list[CourseCatalogItem])
def list_course_catalog(current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    rows = db.query(DBCourse).order_by(DBCourse.created_at.desc()).all()
    items: list[CourseCatalogItem] = []
    for course in rows:
        class_rows = list_course_class_rows(db, course.id)
        if not class_rows:
            continue
        detail = _course_to_schema(course, db, joined=False)
        items.append(
            CourseCatalogItem(
                course_id=course.id,
                course_name=course.name,
                teacher_name=detail.teacher_name,
                term=course.term or "",
                class_options=[item.class_name for item in class_rows],
            )
        )
    return items


@router.post("/join", response_model=Course)
def join_course(body: CourseJoinRequest, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    invite_code = (body.invite_code or "").strip().upper()
    if not invite_code:
        raise HTTPException(status_code=400, detail="请输入课程邀请码")
    course_class = db.query(DBCourseClass).filter(DBCourseClass.invite_code == invite_code).first()
    course = None
    if course_class:
        course = db.query(DBCourse).filter(DBCourse.id == course_class.course_id).first()
    if not course:
        course = db.query(DBCourse).filter(DBCourse.invite_code == invite_code).first()
    if not course:
        raise HTTPException(status_code=404, detail="邀请码无效或课程不存在")
    class_rows = list_course_class_rows(db, course.id)
    desired_class = (body.class_name or "").strip()
    if desired_class:
        matched = next((item for item in class_rows if item.class_name == desired_class), None)
        if not matched:
            raise HTTPException(status_code=400, detail="所选班级不属于该课程")
        course_class = matched
    elif course_class is None and len(class_rows) == 1:
        course_class = class_rows[0]
    elif course_class is None and len(class_rows) > 1:
        raise HTTPException(status_code=400, detail="该课程包含多个班级，请先选择班级")
    class_name = course_class.class_name if course_class else ""
    ensure_course_member(
        db,
        course_id=course.id,
        user_id=current_user["id"],
        role="student",
        class_name=class_name,
        source="invite_code",
    )
    if course_class:
        ensure_discussion_space_for_course_class(db, course=course, class_name=course_class.class_name, teacher_user_id=course.owner_user_id or "")
    db.commit()
    db.refresh(course)
    return _course_to_schema(course, db, joined=True)


@router.get("/{course_id}", response_model=Course)
def get_course(course_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user["role"] == "teacher":
        course = ensure_teacher_course_access(course_id, current_user, db)
        return _course_to_schema(course, db, joined=False)
    course = ensure_student_course_access(course_id, current_user, db)
    return _course_to_schema(course, db, joined=current_user["role"] == "student")
