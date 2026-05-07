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
    from ..security import hash_password

    now = datetime.now().isoformat()
    classes = [
        {"name": "2024级智能车辆工程1班", "college": "未来交通学院", "major": "智能车辆工程", "grade": "2024", "year": "2024"},
        {"name": "2024级人工智能2班", "college": "计算学部", "major": "人工智能", "grade": "2024", "year": "2024"},
        {"name": "2023级软件工程1班", "college": "计算学部", "major": "软件工程", "grade": "2023", "year": "2023"},
    ]
    class_rows: dict[str, DBSchoolClass] = {}
    for item in classes:
        row = db.query(DBSchoolClass).filter(DBSchoolClass.name == item["name"]).first()
        if not row:
            row = DBSchoolClass(id=f"class-{uuid4().hex[:10]}", status="active", created_at=now, updated_at=now, **item)
            db.add(row)
            db.flush()
        class_rows[item["name"]] = row

    teacher_specs = [
        ("teacher_demo", "Teacher123!", "示例教师A", "user-teacher-demo"),
        ("teacher_demo_2", "Teacher123!", "示例教师B", "user-teacher-002"),
        ("teacher_demo_3", "Teacher123!", "示例教师C", "user-teacher-003"),
    ]
    teacher_users = []
    for account, pwd, name, uid in teacher_specs:
        teacher_users.append(_ensure_user(db, role="teacher", account=account, password_hash=hash_password(pwd), display_name=name, user_id=uid))

    student_users = []
    for idx in range(1, 28):
        account = "student_demo" if idx == 1 else f"student_demo_{idx:02d}"
        uid = "user-student-demo" if idx == 1 else f"user-student-{idx:03d}"
        display = f"示例学生{idx:02d}"
        student_users.append(_ensure_user(db, role="student", account=account, password_hash=hash_password("Student123!"), display_name=display, user_id=uid))

    for idx, stu in enumerate(student_users):
        class_name = classes[idx % len(classes)]["name"]
        profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == stu.id).first()
        if not profile:
            profile = DBUserProfile(user_id=stu.id, created_at=now)
            db.add(profile)
        profile.real_name = stu.display_name
        profile.class_name = class_name
        profile.student_no = profile.student_no or f"S2026{idx+1:04d}"
        profile.college = profile.college or "模拟学院"
        profile.major = profile.major or "模拟专业"
        profile.updated_at = now

    for teacher in teacher_users:
        profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == teacher.id).first()
        if not profile:
            profile = DBUserProfile(user_id=teacher.id, created_at=now)
            db.add(profile)
        profile.real_name = teacher.display_name
        profile.department = profile.department or "模拟教研室"
        profile.teacher_no = profile.teacher_no or f"T2026{teacher.id[-3:]}"
        profile.updated_at = now

    course_specs = [
        ("新能源汽车热安全", "NEV-TS-001"),
        ("智能驾驶感知系统", "AIDR-002"),
        ("车载嵌入式软件工程", "AUTO-SE-003"),
        ("数据结构与算法实践", "DSA-004"),
        ("工程伦理与科研规范", "ETH-005"),
    ]
    ac_rows = []
    for name, code in course_specs:
        row = db.query(DBAcademicCourse).filter(DBAcademicCourse.code == code).first()
        if not row:
            row = DBAcademicCourse(id=f"ac-{uuid4().hex[:10]}", name=name, code=code, description="模拟课程", credit="2.0", department="示例院系", status="active", created_at=now, updated_at=now)
            db.add(row)
            db.flush()
        ac_rows.append(row)

    # Ensure teacher_demo has at least one underlying legacy course.
    legacy_course = db.query(DBCourse).filter(DBCourse.owner_user_id == "user-teacher-demo").first()
    if not legacy_course:
        legacy_course = DBCourse(
            id=f"course-{uuid4().hex[:8]}",
            name="示例课程闭环演示",
            class_name=classes[0]["name"],
            audience=classes[0]["name"],
            owner_user_id="user-teacher-demo",
            frontier_direction="智能教学",
            created_at=now,
        )
        db.add(legacy_course)
        db.flush()

    for i, ac in enumerate(ac_rows):
        class_name = classes[i % len(classes)]["name"]
        teacher = teacher_users[i % len(teacher_users)]
        clazz = class_rows[class_name]
        existed = db.query(DBCourseOffering).filter(
            DBCourseOffering.academic_course_id == ac.id,
            DBCourseOffering.teacher_user_id == teacher.id,
            DBCourseOffering.class_id == clazz.id,
            DBCourseOffering.semester == "2025-2026-2",
        ).first()
        if existed:
            continue
        invite_code = f"C{i+1}A{abs(hash(ac.code)) % 10000:04d}"
        space = DBDiscussionSpace(
            id=f"space-{uuid4().hex[:10]}",
            course_id=legacy_course.id if i == 0 else "",
            class_name=class_name,
            space_name=f"{ac.name}-{class_name}-讨论空间",
            ai_assistant_enabled=1,
            created_at=now,
        )
        db.add(space)
        db.flush()
        off = DBCourseOffering(
            id=f"off-{uuid4().hex[:10]}",
            academic_course_id=ac.id,
            course_id=legacy_course.id if i == 0 else "",
            teacher_user_id=teacher.id,
            class_id=clazz.id,
            semester="2025-2026-2",
            invite_code=invite_code,
            join_enabled=1,
            discussion_space_id=space.id,
            status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(off)
        db.flush()
        if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == space.id, DBDiscussionSpaceMember.user_id == teacher.id).first():
            db.add(DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space.id, user_id=teacher.id, role_in_space="teacher", joined_at=now))
        for stu in student_users:
            profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == stu.id).first()
            if not profile or profile.class_name != class_name:
                continue
            if not db.query(DBCourseEnrollment).filter(DBCourseEnrollment.offering_id == off.id, DBCourseEnrollment.student_user_id == stu.id).first():
                db.add(DBCourseEnrollment(id=f"enr-{uuid4().hex[:10]}", offering_id=off.id, student_user_id=stu.id, class_id=clazz.id, source="admin", status="active", joined_at=now, created_at=now))
            if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == space.id, DBDiscussionSpaceMember.user_id == stu.id).first():
                db.add(DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space.id, user_id=stu.id, role_in_space="student", joined_at=now))

    return {"classes": len(classes), "teachers": len(teacher_users), "students": len(student_users), "academic_courses": len(ac_rows)}


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
