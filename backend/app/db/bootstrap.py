"""Database initialization and compatibility bootstrap helpers."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Iterable
from uuid import uuid4

from sqlalchemy import inspect, text

from .models import (
    DBCourse,
    DBCourseClass,
    DBDiscussionMessage,
    DBDiscussionSpace,
    DBDiscussionSpaceMember,
    DBLessonPack,
    DBMaterialUpdateJob,
    DBQALog,
    DBSurveyInstance,
    DBSurveyTemplate,
    DBTeacher,
    DBStudent,
    DBUser,
    DBUserProfile,
    DBWeaknessAnalysis,
)
from .session import Base, SessionLocal, engine


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
    _ensure_columns("questions", [("folder_id", "TEXT DEFAULT ''")])
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

        db.commit()
    finally:
        db.close()
