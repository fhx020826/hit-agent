from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import (
    DBAcademicCourse,
    DBCourseEnrollment,
    DBCourseOffering,
    DBCourse,
    DBDiscussionSpace,
    DBDiscussionSpaceMember,
    DBSchoolClass,
    DBUser,
    DBUserProfile,
    get_db,
)
from ..db.bootstrap import seed_demo_school_data
from ..models.schemas import (
    AcademicCourseCreate,
    AcademicCourseItem,
    CourseOfferingCreate,
    CourseOfferingItem,
    SchoolClassCreate,
    SchoolClassItem,
    StudentJoinCourseRequest,
    StudentSelectClassRequest,
    TeacherCourseCreate,
    TeacherCourseOfferingCreate,
)
from ..security import require_roles
from ..services.course_access import assert_teacher_can_manage_offering, get_student_offerings, get_teacher_offerings

router = APIRouter(prefix="/api", tags=["academic"])


def _now() -> str:
    return datetime.now().isoformat()


def _new_invite_code() -> str:
    return f"C{uuid4().hex[:8].upper()}"


def _class_item(row: DBSchoolClass) -> SchoolClassItem:
    return SchoolClassItem(**row.__dict__)


def _course_item(row: DBAcademicCourse) -> AcademicCourseItem:
    return AcademicCourseItem(**row.__dict__)


def _offering_item(row: DBCourseOffering, db: Session) -> CourseOfferingItem:
    academic = db.query(DBAcademicCourse).filter(DBAcademicCourse.id == row.academic_course_id).first()
    teacher = db.query(DBUser).filter(DBUser.id == row.teacher_user_id).first()
    clazz = db.query(DBSchoolClass).filter(DBSchoolClass.id == row.class_id).first()
    enrolled_count = db.query(DBCourseEnrollment).filter(DBCourseEnrollment.offering_id == row.id, DBCourseEnrollment.status == "active").count()
    return CourseOfferingItem(
        id=row.id,
        academic_course_id=row.academic_course_id,
        academic_course_name=academic.name if academic else "",
        course_id=row.course_id or "",
        teacher_user_id=row.teacher_user_id,
        teacher_name=(teacher.display_name if teacher else ""),
        class_id=row.class_id,
        class_name=clazz.name if clazz else "",
        semester=row.semester or "",
        invite_code=row.invite_code or "",
        join_enabled=bool(row.join_enabled),
        discussion_space_id=row.discussion_space_id or "",
        status=row.status or "active",
        enrolled_count=enrolled_count,
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _ensure_enrollment(db: Session, offering: DBCourseOffering, student_user_id: str, source: str) -> None:
    found = db.query(DBCourseEnrollment).filter(
        DBCourseEnrollment.offering_id == offering.id,
        DBCourseEnrollment.student_user_id == student_user_id,
    ).first()
    if found:
        if found.status != "active":
            found.status = "active"
        return
    db.add(
        DBCourseEnrollment(
            id=f"enroll-{uuid4().hex[:10]}",
            offering_id=offering.id,
            student_user_id=student_user_id,
            class_id=offering.class_id,
            source=source,
            status="active",
            joined_at=_now(),
            created_at=_now(),
        )
    )


def _sync_offering_members(db: Session, offering: DBCourseOffering) -> int:
    profiles = db.query(DBUserProfile).filter(DBUserProfile.class_name != "").all()
    clazz = db.query(DBSchoolClass).filter(DBSchoolClass.id == offering.class_id).first()
    class_name = clazz.name if clazz else ""
    students = db.query(DBUser).filter(DBUser.role == "student", DBUser.status == "active").all()
    count = 0
    for user in students:
        profile = next((p for p in profiles if p.user_id == user.id), None)
        if not profile or profile.class_name != class_name:
            continue
        _ensure_enrollment(db, offering, user.id, "admin")
        count += 1
    if offering.discussion_space_id:
        if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == offering.discussion_space_id, DBDiscussionSpaceMember.user_id == offering.teacher_user_id).first():
            db.add(DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=offering.discussion_space_id, user_id=offering.teacher_user_id, role_in_space="teacher", joined_at=_now()))
        enrollments = db.query(DBCourseEnrollment).filter(DBCourseEnrollment.offering_id == offering.id, DBCourseEnrollment.status == "active").all()
        for enrollment in enrollments:
            if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == offering.discussion_space_id, DBDiscussionSpaceMember.user_id == enrollment.student_user_id).first():
                db.add(DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=offering.discussion_space_id, user_id=enrollment.student_user_id, role_in_space="student", joined_at=_now()))
    return count


@router.get("/admin/academic/classes", response_model=list[SchoolClassItem])
def admin_list_classes(current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rows = db.query(DBSchoolClass).order_by(DBSchoolClass.created_at.desc()).all()
    return [_class_item(row) for row in rows]


@router.post("/admin/academic/classes", response_model=SchoolClassItem)
def admin_create_class(body: SchoolClassCreate, current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    existed = db.query(DBSchoolClass).filter(DBSchoolClass.name == body.name.strip()).first()
    if existed:
        return _class_item(existed)
    now = _now()
    row = DBSchoolClass(
        id=f"class-{uuid4().hex[:10]}",
        name=body.name.strip(),
        college=body.college,
        major=body.major,
        grade=body.grade,
        year=body.year,
        status=body.status,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _class_item(row)


@router.get("/admin/academic/courses", response_model=list[AcademicCourseItem])
def admin_list_academic_courses(current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rows = db.query(DBAcademicCourse).order_by(DBAcademicCourse.created_at.desc()).all()
    return [_course_item(row) for row in rows]


@router.post("/admin/academic/courses", response_model=AcademicCourseItem)
def admin_create_academic_course(body: AcademicCourseCreate, current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    if body.code.strip():
        existed = db.query(DBAcademicCourse).filter(DBAcademicCourse.code == body.code.strip()).first()
        if existed:
            return _course_item(existed)
    now = _now()
    row = DBAcademicCourse(
        id=f"ac-{uuid4().hex[:10]}",
        name=body.name.strip(),
        code=body.code.strip(),
        description=body.description,
        credit=body.credit,
        department=body.department,
        status=body.status,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _course_item(row)


@router.get("/admin/academic/teachers")
def admin_list_teachers(current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    return db.query(DBUser).filter(DBUser.role == "teacher").order_by(DBUser.created_at.desc()).all()


@router.get("/admin/academic/students")
def admin_list_students(class_id: str | None = Query(default=None), current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    students = db.query(DBUser).filter(DBUser.role == "student").order_by(DBUser.created_at.desc()).all()
    if not class_id:
        return students
    clazz = db.query(DBSchoolClass).filter(DBSchoolClass.id == class_id).first()
    if not clazz:
        return []
    profiles = {p.user_id: p for p in db.query(DBUserProfile).all()}
    return [s for s in students if profiles.get(s.id) and profiles[s.id].class_name == clazz.name]


@router.post("/admin/academic/seed-demo-school")
def admin_seed_demo_school(current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    summary = seed_demo_school_data(db)
    db.commit()
    return {"status": "ok", "summary": summary}


@router.post("/admin/academic/offerings", response_model=CourseOfferingItem)
def admin_create_offering(body: CourseOfferingCreate, current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    now = _now()
    row = DBCourseOffering(
        id=f"off-{uuid4().hex[:10]}",
        academic_course_id=body.academic_course_id,
        course_id=body.course_id,
        teacher_user_id=body.teacher_user_id,
        class_id=body.class_id,
        semester=body.semester,
        invite_code=_new_invite_code(),
        join_enabled=1 if body.join_enabled else 0,
        discussion_space_id="",
        status="active",
        created_at=now,
        updated_at=now,
    )
    course = db.query(DBCourse).filter(DBCourse.id == body.course_id).first() if body.course_id else None
    clazz = db.query(DBSchoolClass).filter(DBSchoolClass.id == body.class_id).first()
    space = DBDiscussionSpace(
        id=f"space-{uuid4().hex[:10]}",
        course_id=(course.id if course else ""),
        class_name=(clazz.name if clazz else ""),
        space_name=f"{(course.name if course else '课程')} {(clazz.name if clazz else '')} 讨论空间",
        ai_assistant_enabled=1,
        created_at=now,
    )
    db.add(space)
    db.flush()
    row.discussion_space_id = space.id
    db.add(row)
    db.flush()
    _sync_offering_members(db, row)
    db.commit()
    db.refresh(row)
    return _offering_item(row, db)


@router.get("/admin/academic/offerings", response_model=list[CourseOfferingItem])
def admin_list_offerings(current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rows = db.query(DBCourseOffering).order_by(DBCourseOffering.created_at.desc()).all()
    return [_offering_item(row, db) for row in rows]


@router.post("/admin/academic/offerings/{offering_id}/sync-class-students")
def admin_sync_class_students(offering_id: str, current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    offering = db.query(DBCourseOffering).filter(DBCourseOffering.id == offering_id).first()
    if not offering:
        raise HTTPException(status_code=404, detail="开课关系不存在")
    count = _sync_offering_members(db, offering)
    db.commit()
    return {"status": "ok", "synced_students": count}


@router.get("/teacher/course-management/offerings", response_model=list[CourseOfferingItem])
def teacher_list_offerings(current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    rows = get_teacher_offerings(db, current_user["id"])
    return [_offering_item(row, db) for row in rows]


@router.post("/teacher/course-management/courses", response_model=AcademicCourseItem)
def teacher_create_academic_course(body: TeacherCourseCreate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    now = _now()
    row = DBAcademicCourse(
        id=f"ac-{uuid4().hex[:10]}",
        name=body.name.strip(),
        code=body.code.strip(),
        description=body.description,
        credit=body.credit,
        department=body.department,
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _course_item(row)


@router.post("/teacher/course-management/offerings", response_model=CourseOfferingItem)
def teacher_create_offering(body: TeacherCourseOfferingCreate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    payload = CourseOfferingCreate(
        academic_course_id=body.academic_course_id,
        teacher_user_id=current_user["id"],
        class_id=body.class_id,
        semester=body.semester,
        course_id=body.course_id,
        join_enabled=body.join_enabled,
    )
    return admin_create_offering(payload, {"id": current_user["id"], "role": "admin"}, db)


@router.get("/teacher/course-management/offerings/{offering_id}/students")
def teacher_offering_students(offering_id: str, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    offering = assert_teacher_can_manage_offering(db, current_user["id"], offering_id)
    enrollments = db.query(DBCourseEnrollment).filter(DBCourseEnrollment.offering_id == offering.id, DBCourseEnrollment.status == "active").all()
    users = {u.id: u for u in db.query(DBUser).filter(DBUser.role == "student").all()}
    profiles = {p.user_id: p for p in db.query(DBUserProfile).all()}
    return [
        {
            "student_user_id": e.student_user_id,
            "student_no": profiles[e.student_user_id].student_no if profiles.get(e.student_user_id) else "",
            "display_name": users[e.student_user_id].display_name if users.get(e.student_user_id) else "",
            "class_name": profiles[e.student_user_id].class_name if profiles.get(e.student_user_id) else "",
            "source": e.source,
            "joined_at": e.joined_at,
        }
        for e in enrollments
    ]


@router.post("/teacher/course-management/offerings/{offering_id}/invite", response_model=CourseOfferingItem)
def teacher_refresh_invite_code(offering_id: str, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    offering = assert_teacher_can_manage_offering(db, current_user["id"], offering_id)
    offering.invite_code = _new_invite_code()
    offering.updated_at = _now()
    db.commit()
    db.refresh(offering)
    return _offering_item(offering, db)


@router.patch("/teacher/course-management/offerings/{offering_id}", response_model=CourseOfferingItem)
def teacher_patch_offering(offering_id: str, payload: dict, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    offering = assert_teacher_can_manage_offering(db, current_user["id"], offering_id)
    if "semester" in payload:
        offering.semester = str(payload["semester"])
    if "join_enabled" in payload:
        offering.join_enabled = 1 if bool(payload["join_enabled"]) else 0
    if "status" in payload:
        offering.status = str(payload["status"])
    offering.updated_at = _now()
    db.commit()
    db.refresh(offering)
    return _offering_item(offering, db)


@router.get("/student/courses", response_model=list[CourseOfferingItem])
def student_my_courses(current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    rows = get_student_offerings(db, current_user["id"])
    return [_offering_item(row, db) for row in rows]


@router.get("/student/classes", response_model=list[SchoolClassItem])
def student_classes(current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    rows = db.query(DBSchoolClass).order_by(DBSchoolClass.created_at.desc()).all()
    return [_class_item(row) for row in rows]


@router.get("/student/courses/search", response_model=list[CourseOfferingItem])
def student_search_courses(keyword: str = Query(default=""), current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    rows = db.query(DBCourseOffering).filter(DBCourseOffering.join_enabled == 1, DBCourseOffering.status == "active").all()
    items = [_offering_item(row, db) for row in rows]
    text = keyword.strip().lower()
    if not text:
        return items
    return [item for item in items if text in item.academic_course_name.lower() or text in item.class_name.lower() or text in item.invite_code.lower()]


@router.post("/student/courses/join", response_model=CourseOfferingItem)
def student_join_course(body: StudentJoinCourseRequest, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    code = body.code.strip().upper()
    offering = db.query(DBCourseOffering).filter(DBCourseOffering.invite_code == code, DBCourseOffering.status == "active").first()
    if not offering or not bool(offering.join_enabled):
        raise HTTPException(status_code=400, detail="课程码无效或未开放加入")
    _ensure_enrollment(db, offering, current_user["id"], "code")
    _sync_offering_members(db, offering)
    db.commit()
    db.refresh(offering)
    return _offering_item(offering, db)


@router.post("/student/courses/select-class")
def student_select_class(body: StudentSelectClassRequest, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    clazz = db.query(DBSchoolClass).filter(DBSchoolClass.id == body.class_id).first()
    if not clazz:
        raise HTTPException(status_code=404, detail="班级不存在")
    profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == current_user["id"]).first()
    if not profile:
        profile = DBUserProfile(user_id=current_user["id"], created_at=_now())
        db.add(profile)
    profile.class_name = clazz.name
    profile.updated_at = _now()
    db.commit()
    return {"status": "ok", "class_name": clazz.name}

