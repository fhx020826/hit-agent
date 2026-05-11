"""Database initialization and compatibility bootstrap helpers."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Iterable
from uuid import uuid4

from sqlalchemy import inspect, text

from .models import (
    DBAcademicCourse,
    DBCourse,
    DBCourseEnrollment,
    DBCourseClass,
    DBCourseOffering,
    DBDiscussionMessage,
    DBDiscussionSpace,
    DBDiscussionSpaceMember,
    DBLessonPack,
    DBMaterialUpdateJob,
    DBQALog,
    DBSchoolClass,
    DBSurveyInstance,
    DBSurveyTemplate,
    DBTeacher,
    DBStudent,
    DBUser,
    DBUserProfile,
    DBWeaknessAnalysis,
)
from .session import Base, SessionLocal, engine


def _ensure_user(
    db,
    *,
    role: str,
    account: str,
    password_hash: str,
    display_name: str,
    user_id: str,
):
    row = db.query(DBUser).filter(DBUser.account == account).first()
    if row:
        return row
    row = DBUser(
        id=user_id,
        role=role,
        account=account,
        password_hash=password_hash,
        display_name=display_name,
        status="active",
        created_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.flush()
    return row


def seed_demo_school_data(db) -> dict:
    import os
    import random

    from ..security import hash_password

    now = datetime.now().isoformat()
    semester = os.getenv("DEMO_SEMESTER", "2025-2026-2")
    teacher_count = max(1, int(os.getenv("DEMO_TEACHER_COUNT", "6")))
    student_count = max(1, int(os.getenv("DEMO_STUDENT_COUNT", "60")))
    course_count = max(1, int(os.getenv("DEMO_COURSE_COUNT", "8")))
    min_courses_per_student = max(1, int(os.getenv("DEMO_MIN_COURSES_PER_STUDENT", "2")))
    max_courses_per_student = max(min_courses_per_student, int(os.getenv("DEMO_MAX_COURSES_PER_STUDENT", "5")))
    min_students_per_course = max(1, int(os.getenv("DEMO_MIN_STUDENTS_PER_COURSE", "8")))
    teacher_password = os.getenv("DEMO_TEACHER_PASSWORD", "Teacher123!")
    student_password = os.getenv("DEMO_STUDENT_PASSWORD", "Student123!")
    rng = random.Random(20260508)

    class_specs = [
        ("AI 2024 Class 1", "Computing School", "Artificial Intelligence", "2024", "2024"),
        ("SE 2024 Class 1", "Computing School", "Software Engineering", "2024", "2024"),
        ("IVE 2024 Class 1", "Future Mobility School", "Intelligent Vehicle Engineering", "2024", "2024"),
        ("DS 2023 Class 1", "Computing School", "Data Science", "2023", "2023"),
        ("AUTO 2023 Class 1", "Automation School", "Automation", "2023", "2023"),
        ("EE 2022 Class 1", "Information School", "Electronic Engineering", "2022", "2022"),
    ]
    class_count = min(len(class_specs), max(3, (student_count + 11) // 12))
    class_rows: list[DBSchoolClass] = []
    created_classes = 0
    for index, spec in enumerate(class_specs[:class_count], start=1):
        name, college, major, grade, year = spec
        row = db.query(DBSchoolClass).filter(DBSchoolClass.name == name).first()
        if not row:
            row = DBSchoolClass(
                id=f"demo-class-{index:03d}",
                name=name,
                college=college,
                major=major,
                grade=grade,
                year=year,
                status="active",
                created_at=now,
                updated_at=now,
            )
            db.add(row)
            db.flush()
            created_classes += 1
        class_rows.append(row)

    created_teachers = 0
    teacher_users = []
    for index in range(1, teacher_count + 1):
        account = "teacher_demo" if index == 1 else f"teacher{index-1:03d}"
        display_name = "Demo Teacher" if index == 1 else f"Demo Teacher {index-1:03d}"
        user_id = "user-teacher-demo" if index == 1 else f"user-demo-teacher-{index-1:03d}"
        user = _ensure_user(
            db,
            role="teacher",
            account=account,
            password_hash=hash_password(teacher_password),
            display_name=display_name,
            user_id=user_id,
        )
        teacher_users.append(user)
        if user.created_at == now:
            created_teachers += 1
        profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == user.id).first()
        if not profile:
            profile = DBUserProfile(user_id=user.id, created_at=now)
            db.add(profile)
        profile.real_name = display_name
        profile.department = profile.department or "Demo Teaching Department"
        profile.teacher_no = profile.teacher_no or f"T{2026000 + index}"
        profile.role_title = profile.role_title or "Lecturer"
        profile.updated_at = now

    created_students = 0
    student_users = []
    for index in range(1, student_count + 1):
        account = "student_demo" if index == 1 else f"student{index-1:03d}"
        display_name = "Demo Student" if index == 1 else f"Demo Student {index-1:03d}"
        user_id = "user-student-demo" if index == 1 else f"user-demo-student-{index-1:03d}"
        user = _ensure_user(
            db,
            role="student",
            account=account,
            password_hash=hash_password(student_password),
            display_name=display_name,
            user_id=user_id,
        )
        student_users.append(user)
        if user.created_at == now:
            created_students += 1
        clazz = class_rows[(index - 1) % len(class_rows)]
        profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == user.id).first()
        if not profile:
            profile = DBUserProfile(user_id=user.id, created_at=now)
            db.add(profile)
        profile.real_name = display_name
        profile.class_name = clazz.name
        profile.student_no = profile.student_no or f"S{20260000 + index}"
        profile.college = profile.college or clazz.college
        profile.major = profile.major or clazz.major
        profile.grade = profile.grade or clazz.grade
        profile.updated_at = now

    base_course_specs = [
        ("New Energy Vehicle Thermal Safety", "DEMO-COURSE-001", "Battery thermal safety and management"),
        ("Autonomous Driving Perception", "DEMO-COURSE-002", "Multimodal sensing and fusion"),
        ("Automotive Embedded Software", "DEMO-COURSE-003", "Vehicle control software engineering"),
        ("Data Structures and Algorithms", "DEMO-COURSE-004", "Algorithms for engineering systems"),
        ("Engineering Ethics", "DEMO-COURSE-005", "Engineering responsibility and research norms"),
        ("Computer Networks", "DEMO-COURSE-006", "Protocols and networked systems"),
        ("Machine Learning Foundations", "DEMO-COURSE-007", "Introductory machine learning methods"),
        ("Software Testing", "DEMO-COURSE-008", "Testing design and quality assurance"),
        ("Database Systems", "DEMO-COURSE-009", "Data modeling and transaction systems"),
        ("Human-Computer Interaction", "DEMO-COURSE-010", "Interaction design and usability"),
    ]
    while len(base_course_specs) < course_count:
        next_index = len(base_course_specs) + 1
        base_course_specs.append((f"Demo Course {next_index:03d}", f"DEMO-COURSE-{next_index:03d}", "Demo course description"))

    created_academic_courses = 0
    created_legacy_courses = 0
    academic_courses: list[DBAcademicCourse] = []
    legacy_courses: dict[str, DBCourse] = {}
    for index, (name, code, description) in enumerate(base_course_specs[:course_count], start=1):
        academic = db.query(DBAcademicCourse).filter(DBAcademicCourse.code == code).first()
        if not academic:
            academic = DBAcademicCourse(
                id=f"demo-academic-{index:03d}",
                name=name,
                code=code,
                description=description,
                credit="2.0",
                department="Demo Department",
                status="active",
                created_at=now,
                updated_at=now,
            )
            db.add(academic)
            db.flush()
            created_academic_courses += 1
        academic_courses.append(academic)
        legacy = db.query(DBCourse).filter(DBCourse.id == f"demo-course-{index:03d}").first()
        if not legacy:
            legacy = DBCourse(
                id=f"demo-course-{index:03d}",
                name=name,
                audience="Demo Students",
                class_name=class_rows[(index - 1) % len(class_rows)].name,
                student_level="undergraduate",
                chapter="Course overview",
                objectives=f"Support teaching flow for {name}",
                duration_minutes=90,
                frontier_direction=description,
                owner_user_id="",
                created_at=now,
            )
            db.add(legacy)
            db.flush()
            created_legacy_courses += 1
        legacy_courses[academic.id] = legacy

    created_offerings = 0
    offering_rows: list[DBCourseOffering] = []
    for index, academic in enumerate(academic_courses, start=1):
        teacher = teacher_users[(index - 1) % len(teacher_users)]
        clazz = class_rows[(index - 1) % len(class_rows)]
        legacy = legacy_courses[academic.id]
        legacy.owner_user_id = teacher.id
        legacy.class_name = clazz.name
        legacy.audience = clazz.name
        existed = db.query(DBCourseOffering).filter(DBCourseOffering.academic_course_id == academic.id, DBCourseOffering.semester == semester).first()
        if not existed:
            existed = DBCourseOffering(
                id=f"demo-offering-{index:03d}",
                academic_course_id=academic.id,
                course_id=legacy.id,
                teacher_user_id=teacher.id,
                class_id=clazz.id,
                semester=semester,
                invite_code=f"DEBUG-{index:03d}",
                join_enabled=0,
                discussion_space_id="",
                status="active",
                created_at=now,
                updated_at=now,
            )
            db.add(existed)
            db.flush()
            created_offerings += 1
        else:
            existed.teacher_user_id = teacher.id
            existed.course_id = legacy.id
            existed.class_id = clazz.id
            existed.join_enabled = 0
            existed.status = "active"
            existed.updated_at = now
        if not existed.discussion_space_id:
            space = DBDiscussionSpace(
                id=f"demo-space-{index:03d}",
                course_id=legacy.id,
                class_name=clazz.name,
                space_name=f"{academic.name} Discussion Space",
                offering_id=existed.id,
                ai_assistant_enabled=1,
                created_at=now,
            )
            db.add(space)
            db.flush()
            existed.discussion_space_id = space.id
        offering_rows.append(existed)

    selections: dict[str, set[str]] = {off.id: set() for off in offering_rows}
    student_to_courses: dict[str, set[str]] = {}
    offering_ids = [off.id for off in offering_rows]
    sample_min = min(min_courses_per_student, len(offering_ids))
    sample_max = min(max_courses_per_student, len(offering_ids))
    for student in student_users:
        sample_size = rng.randint(sample_min, sample_max)
        chosen = set(rng.sample(offering_ids, sample_size))
        student_to_courses[student.id] = chosen
        for offering_id in chosen:
            selections[offering_id].add(student.id)

    for offering_id, enrolled in selections.items():
        if len(enrolled) >= min_students_per_course:
            continue
        missing = min_students_per_course - len(enrolled)
        candidates = [student.id for student in student_users if offering_id not in student_to_courses[student.id]]
        rng.shuffle(candidates)
        for student_id in candidates[:missing]:
            student_to_courses[student_id].add(offering_id)
            enrolled.add(student_id)

    created_enrollments = 0
    for offering in offering_rows:
        if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == offering.discussion_space_id, DBDiscussionSpaceMember.user_id == offering.teacher_user_id).first():
            db.add(DBDiscussionSpaceMember(id=f"demo-space-member-teacher-{offering.id}", space_id=offering.discussion_space_id, user_id=offering.teacher_user_id, role_in_space="teacher", joined_at=now))
        for student_id in sorted(selections[offering.id]):
            existing = db.query(DBCourseEnrollment).filter(DBCourseEnrollment.offering_id == offering.id, DBCourseEnrollment.student_user_id == student_id).first()
            if not existing:
                db.add(
                    DBCourseEnrollment(
                        id=f"demo-enrollment-{offering.id}-{student_id}"[:64],
                        offering_id=offering.id,
                        student_user_id=student_id,
                        class_id=offering.class_id,
                        source="simulated_selection",
                        status="active",
                        joined_at=now,
                        created_at=now,
                    )
                )
                created_enrollments += 1
            if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == offering.discussion_space_id, DBDiscussionSpaceMember.user_id == student_id).first():
                db.add(DBDiscussionSpaceMember(id=f"demo-space-member-{offering.id}-{student_id}"[:64], space_id=offering.discussion_space_id, user_id=student_id, role_in_space="student", joined_at=now))

    return {
        "already_seeded": all(value == 0 for value in [created_classes, created_teachers, created_students, created_academic_courses, created_legacy_courses, created_offerings, created_enrollments]),
        "semester": semester,
        "classes": len(class_rows),
        "teachers": len(teacher_users),
        "students": len(student_users),
        "academic_courses": len(academic_courses),
        "created": {
            "classes": created_classes,
            "teachers": created_teachers,
            "students": created_students,
            "academic_courses": created_academic_courses,
            "legacy_courses": created_legacy_courses,
            "offerings": created_offerings,
            "enrollments": created_enrollments,
        },
        "default_passwords": {
            "teacher": teacher_password,
            "student": student_password,
        },
    }


def reset_demo_school_data(db) -> dict:
    demo_accounts = ["teacher_demo", "student_demo"]
    demo_user_ids = {row.id for row in db.query(DBUser).filter(DBUser.account.in_(demo_accounts)).all()}
    demo_user_ids.update({row.id for row in db.query(DBUser).filter(DBUser.account.like("teacher%"), DBUser.role == "teacher").all()})
    demo_user_ids.update({row.id for row in db.query(DBUser).filter(DBUser.account.like("student%"), DBUser.role == "student").all()})

    offering_rows = db.query(DBCourseOffering).filter(DBCourseOffering.id.like("demo-offering-%")).all()
    offering_ids = [row.id for row in offering_rows]
    space_ids = [row.discussion_space_id for row in offering_rows if row.discussion_space_id]
    academic_ids = [row.academic_course_id for row in offering_rows]
    legacy_course_ids = [row.course_id for row in offering_rows if row.course_id]

    deleted = {
        "discussion_members": db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id.in_(space_ids)).delete(synchronize_session=False) if space_ids else 0,
        "enrollments": db.query(DBCourseEnrollment).filter(DBCourseEnrollment.offering_id.in_(offering_ids)).delete(synchronize_session=False) if offering_ids else 0,
        "offerings": db.query(DBCourseOffering).filter(DBCourseOffering.id.in_(offering_ids)).delete(synchronize_session=False) if offering_ids else 0,
        "spaces": db.query(DBDiscussionSpace).filter(DBDiscussionSpace.id.in_(space_ids)).delete(synchronize_session=False) if space_ids else 0,
        "academic_courses": db.query(DBAcademicCourse).filter(DBAcademicCourse.id.in_(academic_ids)).delete(synchronize_session=False) if academic_ids else 0,
        "legacy_courses": db.query(DBCourse).filter(DBCourse.id.in_(legacy_course_ids)).delete(synchronize_session=False) if legacy_course_ids else 0,
        "profiles": db.query(DBUserProfile).filter(DBUserProfile.user_id.in_(demo_user_ids)).delete(synchronize_session=False) if demo_user_ids else 0,
        "users": db.query(DBUser).filter(DBUser.id.in_(demo_user_ids)).delete(synchronize_session=False) if demo_user_ids else 0,
        "classes": db.query(DBSchoolClass).filter(DBSchoolClass.id.like("demo-class-%")).delete(synchronize_session=False),
    }
    return deleted


def export_demo_school_accounts(db) -> dict:
    import os

    teacher_password = os.getenv("DEMO_TEACHER_PASSWORD", "Teacher123!")
    student_password = os.getenv("DEMO_STUDENT_PASSWORD", "Student123!")
    teacher_rows = db.query(DBUser).filter(DBUser.role == "teacher").order_by(DBUser.account.asc()).all()
    student_rows = db.query(DBUser).filter(DBUser.role == "student").order_by(DBUser.account.asc()).all()
    profiles = {row.user_id: row for row in db.query(DBUserProfile).all()}
    offerings = {row.id: row for row in db.query(DBCourseOffering).all()}
    academic_courses = {row.id: row for row in db.query(DBAcademicCourse).all()}
    enrollments = db.query(DBCourseEnrollment).filter(DBCourseEnrollment.status == "active").all()
    student_courses: dict[str, list[str]] = {}
    teacher_courses: dict[str, list[str]] = {}
    for enrollment in enrollments:
        offering = offerings.get(enrollment.offering_id)
        academic = academic_courses.get(offering.academic_course_id) if offering else None
        if academic:
            student_courses.setdefault(enrollment.student_user_id, []).append(academic.name)
    for offering in offerings.values():
        academic = academic_courses.get(offering.academic_course_id)
        if academic:
            teacher_courses.setdefault(offering.teacher_user_id, []).append(academic.name)
    return {
        "teachers": [
            {
                "account": row.account,
                "display_name": row.display_name,
                "teacher_no": profiles[row.id].teacher_no if profiles.get(row.id) else "",
                "department": profiles[row.id].department if profiles.get(row.id) else "",
                "initial_password": teacher_password,
                "courses": sorted(teacher_courses.get(row.id, [])),
            }
            for row in teacher_rows
        ],
        "students": [
            {
                "account": row.account,
                "display_name": row.display_name,
                "student_no": profiles[row.id].student_no if profiles.get(row.id) else "",
                "class_name": profiles[row.id].class_name if profiles.get(row.id) else "",
                "initial_password": student_password,
                "courses": sorted(student_courses.get(row.id, [])),
            }
            for row in student_rows
        ],
    }


def _ensure_columns(table_name: str, column_defs: Iterable[tuple[str, str]]) -> None:
    inspector = inspect(engine)
    existing = {column["name"] for column in inspector.get_columns(table_name)}
    with engine.begin() as conn:
        for name, sql_type in column_defs:
            if name not in existing:
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {name} {sql_type}"))


def init_db() -> None:
    Base.metadata.create_all(bind=engine)

    _ensure_columns(
        "qa_logs",
        [
            ("student_id", "TEXT DEFAULT ''"),
            ("student_name", "TEXT DEFAULT ''"),
            ("student_grade", "TEXT DEFAULT ''"),
            ("student_major", "TEXT DEFAULT ''"),
            ("student_gender", "TEXT DEFAULT ''"),
            ("is_anonymous", "INTEGER DEFAULT 0"),
        ],
    )
    _ensure_columns("courses", [("owner_user_id", "TEXT DEFAULT ''"), ("class_name", "TEXT DEFAULT ''")])
    _ensure_columns(
        "questions",
        [
            ("folder_id", "TEXT DEFAULT ''"),
            ("parent_folder_id", "TEXT DEFAULT ''"),
            ("title", "TEXT DEFAULT ''"),
            ("note", "TEXT DEFAULT ''"),
            ("updated_at", "TEXT DEFAULT ''"),
        ],
    )
    _ensure_columns(
        "question_folders",
        [
            ("parent_folder_id", "TEXT DEFAULT ''"),
            ("description", "TEXT DEFAULT ''"),
        ],
    )
    _ensure_columns(
        "materials",
        [
            ("file_path", "TEXT DEFAULT ''"),
            ("uploader_user_id", "TEXT DEFAULT ''"),
            ("file_size", "INTEGER DEFAULT 0"),
            ("share_scope", "TEXT DEFAULT 'private'"),
            ("allow_student_view", "INTEGER DEFAULT 1"),
            ("allow_classroom_share", "INTEGER DEFAULT 1"),
            ("allow_request", "INTEGER DEFAULT 1"),
            ("class_name", "TEXT DEFAULT ''"),
            ("has_saved_annotation", "INTEGER DEFAULT 0"),
        ],
    )
    _ensure_columns("survey_instances", [("trigger_mode", "TEXT DEFAULT 'manual'")])
    _ensure_columns("appearance_settings", [("language", "TEXT DEFAULT 'zh-CN'")])
    _ensure_columns(
        "material_requests",
        [
            ("material_id", "INTEGER DEFAULT 0"),
            ("class_name", "TEXT DEFAULT ''"),
            ("handled_at", "TEXT DEFAULT ''"),
            ("handled_by", "TEXT DEFAULT ''"),
        ],
    )
    _ensure_columns(
        "material_update_jobs",
        [
            ("selected_model", "TEXT DEFAULT 'default'"),
            ("used_model_name", "TEXT DEFAULT ''"),
            ("model_status", "TEXT DEFAULT 'ok'"),
            ("generated_file_name", "TEXT DEFAULT ''"),
            ("generated_file_path", "TEXT DEFAULT ''"),
            ("generated_file_type", "TEXT DEFAULT ''"),
        ],
    )
    _ensure_columns(
        "knowledge_chunks",
        [
            ("embedding_json", "TEXT DEFAULT ''"),
            ("embedding_model", "TEXT DEFAULT ''"),
            ("embedding_updated_at", "TEXT DEFAULT ''"),
        ],
    )
    _ensure_columns("assignments", [("offering_id", "TEXT DEFAULT ''")])
    _ensure_columns("chat_sessions", [("offering_id", "TEXT DEFAULT ''")])
    _ensure_columns("questions", [("offering_id", "TEXT DEFAULT ''")])
    _ensure_columns("survey_instances", [("offering_id", "TEXT DEFAULT ''")])
    _ensure_columns("materials", [("offering_id", "TEXT DEFAULT ''")])
    _ensure_columns("discussion_spaces", [("offering_id", "TEXT DEFAULT ''")])
    _ensure_columns("classroom_shares", [("offering_id", "TEXT DEFAULT ''")])
    _ensure_columns("material_requests", [("offering_id", "TEXT DEFAULT ''")])

    from ..security import hash_password
    from ..services.mock_data import get_demo_course, get_demo_lesson_pack

    db = SessionLocal()
    try:
        if db.query(DBCourse).count() == 0:
            course = get_demo_course()
            db.add(
                DBCourse(
                    id=course.id,
                    name=course.name,
                    audience=course.audience,
                    student_level=course.student_level,
                    chapter=course.chapter,
                    objectives=course.objectives,
                    duration_minutes=course.duration_minutes,
                    frontier_direction=course.frontier_direction,
                    created_at=course.created_at.isoformat() if hasattr(course.created_at, "isoformat") else str(course.created_at),
                )
            )

        if db.query(DBLessonPack).count() == 0:
            lesson_pack = get_demo_lesson_pack()
            db.add(
                DBLessonPack(
                    id=lesson_pack.id,
                    course_id=lesson_pack.course_id,
                    version=lesson_pack.version,
                    status=lesson_pack.status,
                    payload=json.dumps(lesson_pack.payload, ensure_ascii=False),
                    created_at=lesson_pack.created_at.isoformat() if hasattr(lesson_pack.created_at, "isoformat") else str(lesson_pack.created_at),
                )
            )

        if db.query(DBTeacher).count() == 0:
            db.add(DBTeacher(id="teacher-demo-001", name="张老师", department="计算机学院", title="讲师", gender="女", created_at=datetime.now().isoformat()))

        if db.query(DBStudent).count() == 0:
            db.add_all(
                [
                    DBStudent(id="student-demo-001", name="李明", grade="2023级", major="计算机科学与技术", gender="男", created_at=datetime.now().isoformat()),
                    DBStudent(id="student-demo-002", name="王悦", grade="2022级", major="软件工程", gender="女", created_at=datetime.now().isoformat()),
                ]
            )

        teacher_user = db.query(DBUser).filter(DBUser.account == "teacher_demo").first()
        if not teacher_user:
            teacher_user = DBUser(
                id="user-teacher-demo",
                role="teacher",
                account="teacher_demo",
                password_hash=hash_password("Teacher123!"),
                display_name="张老师",
                status="active",
                created_at=datetime.now().isoformat(),
            )
            db.add(teacher_user)
        student_user = db.query(DBUser).filter(DBUser.account == "student_demo").first()
        if not student_user:
            student_user = DBUser(
                id="user-student-demo",
                role="student",
                account="student_demo",
                password_hash=hash_password("Student123!"),
                display_name="李明",
                status="active",
                created_at=datetime.now().isoformat(),
            )
            db.add(student_user)
        admin_user = db.query(DBUser).filter(DBUser.account == "admin_demo").first()
        if not admin_user:
            admin_user = DBUser(
                id="user-admin-demo",
                role="admin",
                account="admin_demo",
                password_hash=hash_password("Admin123!"),
                display_name="系统管理员",
                status="active",
                created_at=datetime.now().isoformat(),
            )
            db.add(admin_user)
        db.flush()

        if not db.query(DBUserProfile).filter(DBUserProfile.user_id == "user-teacher-demo").first():
            db.add(
                DBUserProfile(
                    user_id="user-teacher-demo",
                    real_name="张老师",
                    gender="女",
                    college="计算机学院",
                    department="网络与信息安全教研室",
                    teacher_no="T2024001",
                    role_title="讲师",
                    email="teacher_demo@example.com",
                    phone="13800000001",
                    research_direction="网络协议与系统安全",
                    bio="负责课程设计、课堂组织和课后教学改进。",
                    common_courses_json=json.dumps(["计算机网络", "网络协议分析"], ensure_ascii=False),
                    created_at=datetime.now().isoformat(),
                    updated_at=datetime.now().isoformat(),
                )
            )
        if not db.query(DBUserProfile).filter(DBUserProfile.user_id == "user-student-demo").first():
            db.add(
                DBUserProfile(
                    user_id="user-student-demo",
                    real_name="李明",
                    gender="男",
                    college="计算机学院",
                    major="计算机科学与技术",
                    grade="2023级",
                    class_name="计科2301班",
                    student_no="20230001",
                    email="student_demo@example.com",
                    phone="13800000002",
                    interests="网络系统、协议分析",
                    linked_classes_json=json.dumps(["计科2301班"], ensure_ascii=False),
                    created_at=datetime.now().isoformat(),
                    updated_at=datetime.now().isoformat(),
                )
            )
        if not db.query(DBUserProfile).filter(DBUserProfile.user_id == "user-admin-demo").first():
            db.add(
                DBUserProfile(
                    user_id="user-admin-demo",
                    real_name="系统管理员",
                    college="平台运维中心",
                    email="admin_demo@example.com",
                    phone="13800000003",
                    bio="负责全站用户、课程与讨论空间管理。",
                    created_at=datetime.now().isoformat(),
                    updated_at=datetime.now().isoformat(),
                )
            )

        demo_course = db.query(DBCourse).filter(DBCourse.id == "demo-course-001").first()
        if demo_course and not demo_course.owner_user_id:
            demo_course.owner_user_id = "user-teacher-demo"
        if demo_course and not demo_course.class_name:
            demo_course.class_name = "计科2301班"

        if demo_course and not db.query(DBCourseClass).filter(DBCourseClass.course_id == demo_course.id, DBCourseClass.class_name == "计科2301班").first():
            space_id = "space-demo-001"
            if not db.query(DBDiscussionSpace).filter(DBDiscussionSpace.id == space_id).first():
                db.add(
                    DBDiscussionSpace(
                        id=space_id,
                        course_id=demo_course.id,
                        class_name="计科2301班",
                        space_name="计算机网络-计科2301班讨论空间",
                        ai_assistant_enabled=1,
                        created_at=datetime.now().isoformat(),
                    )
                )
            db.add(
                DBCourseClass(
                    id="course-class-demo-001",
                    course_id=demo_course.id,
                    class_name="计科2301班",
                    discussion_space_id=space_id,
                    created_at=datetime.now().isoformat(),
                )
            )
            db.flush()
            existing_members = db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == space_id).count()
            if existing_members == 0:
                db.add_all(
                    [
                        DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space_id, user_id="user-teacher-demo", role_in_space="teacher", joined_at=datetime.now().isoformat()),
                        DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space_id, user_id="user-student-demo", role_in_space="student", joined_at=datetime.now().isoformat()),
                        DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space_id, user_id="ai-course-assistant", role_in_space="ai", joined_at=datetime.now().isoformat()),
                    ]
                )
            if db.query(DBDiscussionMessage).filter(DBDiscussionMessage.space_id == space_id).count() == 0:
                db.add_all(
                    [
                        DBDiscussionMessage(
                            id=f"msg-{uuid4().hex[:8]}",
                            space_id=space_id,
                            sender_user_id="user-teacher-demo",
                            sender_type="teacher",
                            is_anonymous=0,
                            message_type="text",
                            content="欢迎进入课程讨论空间。大家可以在这里实名或匿名发言，也可以 @AI 助教参与讨论。",
                            created_at=datetime.now().isoformat(),
                        ),
                        DBDiscussionMessage(
                            id=f"msg-{uuid4().hex[:8]}",
                            space_id=space_id,
                            sender_user_id="ai-course-assistant",
                            sender_type="ai",
                            is_anonymous=0,
                            message_type="text",
                            content="我是课程专属 AI 助教。被 @ 时我会结合最近讨论、课程资料和附件内容参与回答。",
                            ai_sources_json=json.dumps(["课程资料", "最近讨论上下文", "大模型补充解释"], ensure_ascii=False),
                            created_at=datetime.now().isoformat(),
                        ),
                    ]
                )

        if db.query(DBSurveyTemplate).count() == 0:
            default_questions = [
                {"id": "difficulty", "type": "rating", "title": "本次课程难度是否合适", "scale": [1, 5]},
                {"id": "pace", "type": "rating", "title": "讲解节奏是否合适", "scale": [1, 5]},
                {"id": "style", "type": "rating", "title": "教师授课风格是否容易接受", "scale": [1, 5]},
                {"id": "understanding", "type": "rating", "title": "对本次内容理解程度如何", "scale": [1, 5]},
                {"id": "frontier", "type": "choice", "title": "是否希望增加前沿拓展内容", "options": ["希望增加", "保持现状", "暂时不需要"]},
                {"id": "interaction", "type": "choice", "title": "是否喜欢本次课堂互动方式", "options": ["喜欢", "一般", "不太喜欢"]},
                {"id": "comment", "type": "text", "title": "对本次课程的建议", "optional": True},
            ]
            db.add(
                DBSurveyTemplate(
                    id="survey-template-default",
                    name="课堂匿名反馈模板",
                    description="用于课程结束后的匿名课堂反馈",
                    questions_json=json.dumps(default_questions, ensure_ascii=False),
                    created_at=datetime.now().isoformat(),
                )
            )

        if db.query(DBWeaknessAnalysis).count() == 0:
            db.add(
                DBWeaknessAnalysis(
                    id=f"weak-{uuid4().hex[:8]}",
                    user_id="user-student-demo",
                    course_id="demo-course-001",
                    weak_points_json="[]",
                    suggestions_json="[]",
                    summary="当前尚未生成诊断结果。",
                    updated_at=datetime.now().isoformat(),
                )
            )

        seed_demo_school_data(db)
        db.commit()
    finally:
        db.close()
