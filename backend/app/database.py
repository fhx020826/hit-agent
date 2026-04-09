"""SQLite database setup and schema definitions for the teaching platform."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Iterable

from sqlalchemy import Column, Index, Integer, Text, create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql.sqltypes import String

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
QUESTION_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "questions")
ASSIGNMENT_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "assignments")
PROFILE_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "profiles")
MATERIAL_UPDATE_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "material_updates")
MATERIAL_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "materials")
DISCUSSION_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "discussions")

for path in [DATA_DIR, UPLOAD_DIR, QUESTION_UPLOAD_DIR, ASSIGNMENT_UPLOAD_DIR, PROFILE_UPLOAD_DIR, MATERIAL_UPDATE_UPLOAD_DIR, MATERIAL_UPLOAD_DIR, DISCUSSION_UPLOAD_DIR]:
    os.makedirs(path, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "app.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DBCourse(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    audience = Column(String, default="")
    class_name = Column(String, default="")
    student_level = Column(String, default="")
    chapter = Column(String, default="")
    objectives = Column(Text, default="")
    duration_minutes = Column(Integer, default=90)
    frontier_direction = Column(String, default="")
    owner_user_id = Column(String, default="")
    created_at = Column(String)


class DBLessonPack(Base):
    __tablename__ = "lesson_packs"

    id = Column(String, primary_key=True)
    course_id = Column(String, nullable=False)
    version = Column(Integer, default=1)
    status = Column(String, default="draft")
    payload = Column(Text, default="{}")
    created_at = Column(String)


class DBTeacher(Base):
    __tablename__ = "teachers"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    department = Column(String, default="")
    title = Column(String, default="")
    gender = Column(String, default="")
    created_at = Column(String)


class DBStudent(Base):
    __tablename__ = "students"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    grade = Column(String, default="")
    major = Column(String, default="")
    gender = Column(String, default="")
    created_at = Column(String)


class DBUser(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    role = Column(String, nullable=False)
    account = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    display_name = Column(String, default="")
    status = Column(String, default="active")
    created_at = Column(String)


class DBUserProfile(Base):
    __tablename__ = "user_profiles"

    user_id = Column(String, primary_key=True)
    real_name = Column(String, default="")
    gender = Column(String, default="")
    college = Column(String, default="")
    major = Column(String, default="")
    grade = Column(String, default="")
    class_name = Column(String, default="")
    student_no = Column(String, default="")
    teacher_no = Column(String, default="")
    department = Column(String, default="")
    teaching_group = Column(String, default="")
    role_title = Column(String, default="")
    birth_date = Column(String, default="")
    email = Column(String, default="")
    phone = Column(String, default="")
    avatar_path = Column(String, default="")
    bio = Column(Text, default="")
    research_direction = Column(String, default="")
    interests = Column(String, default="")
    common_courses_json = Column(Text, default="[]")
    linked_classes_json = Column(Text, default="[]")
    created_at = Column(String)
    updated_at = Column(String)


class DBSessionToken(Base):
    __tablename__ = "session_tokens"

    token = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    created_at = Column(String)
    expires_at = Column(String)


class DBAppearanceSetting(Base):
    __tablename__ = "appearance_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_role = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    mode = Column(String, default="day")
    accent = Column(String, default="blue")
    font = Column(String, default="default")
    skin = Column(String, default="clean")
    language = Column(String, default="zh-CN")
    updated_at = Column(String)


class DBCourseClass(Base):
    __tablename__ = "course_classes"

    id = Column(String, primary_key=True)
    course_id = Column(String, nullable=False)
    class_name = Column(String, nullable=False)
    discussion_space_id = Column(String, default="")
    created_at = Column(String)


class DBDiscussionSpace(Base):
    __tablename__ = "discussion_spaces"

    id = Column(String, primary_key=True)
    course_id = Column(String, nullable=False)
    class_name = Column(String, default="")
    space_name = Column(String, nullable=False)
    ai_assistant_enabled = Column(Integer, default=1)
    created_at = Column(String)


class DBDiscussionSpaceMember(Base):
    __tablename__ = "discussion_space_members"

    id = Column(String, primary_key=True)
    space_id = Column(String, nullable=False)
    user_id = Column(String, default="")
    role_in_space = Column(String, default="student")
    joined_at = Column(String)


class DBDiscussionMessage(Base):
    __tablename__ = "discussion_messages"
    __table_args__ = (
        Index("idx_discussion_messages_space_id", "space_id"),
        Index("idx_discussion_messages_sender_user_id", "sender_user_id"),
        Index("idx_discussion_messages_created_at", "created_at"),
    )

    id = Column(String, primary_key=True)
    space_id = Column(String, nullable=False)
    sender_user_id = Column(String, default="")
    sender_type = Column(String, default="student")
    is_anonymous = Column(Integer, default=0)
    message_type = Column(String, default="text")
    content = Column(Text, default="")
    reply_to_message_id = Column(String, default="")
    ai_sources_json = Column(Text, default="[]")
    created_at = Column(String)


class DBDiscussionMessageAttachment(Base):
    __tablename__ = "discussion_message_attachments"

    id = Column(String, primary_key=True)
    message_id = Column(String, default="")
    uploader_user_id = Column(String, default="")
    file_name = Column(String, nullable=False)
    file_type = Column(String, default="")
    file_size = Column(Integer, default=0)
    file_path = Column(String, default="")
    parse_status = Column(String, default="pending")
    parse_summary = Column(Text, default="")
    created_at = Column(String)


class DBAIDiscussionContextLog(Base):
    __tablename__ = "ai_discussion_context_logs"

    id = Column(String, primary_key=True)
    space_id = Column(String, nullable=False)
    trigger_message_id = Column(String, nullable=False)
    used_context_range = Column(Text, default="")
    model_name = Column(String, default="")
    response_summary = Column(Text, default="")
    created_at = Column(String)


class DBAgentConfig(Base):
    __tablename__ = "agent_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(String, nullable=False)
    scope_rules = Column(Text, default="")
    answer_style = Column(String, default="讲解型")
    enable_homework_support = Column(Integer, default=1)
    enable_material_qa = Column(Integer, default=1)
    enable_frontier_extension = Column(Integer, default=1)
    updated_at = Column(String)


class DBChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    course_id = Column(String, default="")
    lesson_pack_id = Column(String, default="")
    title = Column(String, default="新建问答")
    selected_model = Column(String, default="default")
    created_at = Column(String)
    updated_at = Column(String)


class DBQuestionFolder(Base):
    __tablename__ = "question_folders"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    course_id = Column(String, default="")
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    created_at = Column(String)
    updated_at = Column(String)


class DBQuestion(Base):
    __tablename__ = "questions"

    id = Column(String, primary_key=True)
    session_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    course_id = Column(String, default="")
    lesson_pack_id = Column(String, default="")
    question_text = Column(Text, default="")
    answer_target_type = Column(String, default="ai")
    selected_model = Column(String, default="default")
    is_anonymous = Column(Integer, default=0)
    status = Column(String, default="submitted")
    teacher_reply_status = Column(String, default="not_requested")
    ai_answer_content = Column(Text, default="")
    ai_answer_time = Column(String, default="")
    ai_answer_sources = Column(Text, default="[]")
    teacher_answer_content = Column(Text, default="")
    teacher_answer_time = Column(String, default="")
    has_attachments = Column(Integer, default=0)
    attachment_count = Column(Integer, default=0)
    input_mode = Column(String, default="text")
    collected = Column(Integer, default=0)
    folder_id = Column(String, default="")
    created_at = Column(String)
    updated_at = Column(String)


class DBQuestionAttachment(Base):
    __tablename__ = "question_attachments"

    id = Column(String, primary_key=True)
    question_id = Column(String, default="")
    uploader_user_id = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    file_type = Column(String, default="")
    file_size = Column(Integer, default=0)
    file_path = Column(String, default="")
    parse_status = Column(String, default="pending")
    parse_summary = Column(Text, default="")
    created_at = Column(String)


class DBTeacherNotification(Base):
    __tablename__ = "teacher_notifications"

    id = Column(String, primary_key=True)
    teacher_id = Column(String, nullable=False)
    message_type = Column(String, default="question")
    related_question_id = Column(String, default="")
    title = Column(String, default="")
    content = Column(Text, default="")
    is_read = Column(Integer, default=0)
    created_at = Column(String)


class DBWeaknessAnalysis(Base):
    __tablename__ = "weakness_analyses"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    course_id = Column(String, default="")
    weak_points_json = Column(Text, default="[]")
    suggestions_json = Column(Text, default="[]")
    summary = Column(Text, default="")
    updated_at = Column(String)


class DBAssignment(Base):
    __tablename__ = "assignments"

    id = Column(String, primary_key=True)
    teacher_id = Column(String, nullable=False)
    course_id = Column(String, default="")
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    target_class = Column(String, default="")
    deadline = Column(String, default="")
    attachment_requirements = Column(Text, default="")
    submission_format = Column(Text, default="")
    grading_notes = Column(Text, default="")
    allow_resubmit = Column(Integer, default=1)
    enable_ai_feedback = Column(Integer, default=1)
    remind_days = Column(Integer, default=1)
    status = Column(String, default="open")
    created_at = Column(String)


class DBAssignmentReceipt(Base):
    __tablename__ = "assignment_receipts"

    id = Column(String, primary_key=True)
    assignment_id = Column(String, nullable=False)
    student_id = Column(String, nullable=False)
    confirmed = Column(Integer, default=0)
    confirmed_at = Column(String, default="")
    created_at = Column(String)


class DBAssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"

    id = Column(String, primary_key=True)
    assignment_id = Column(String, nullable=False)
    student_id = Column(String, nullable=False)
    files_json = Column(Text, default="[]")
    submitted_at = Column(String, default="")
    status = Column(String, default="draft")
    resubmitted_count = Column(Integer, default=0)
    created_at = Column(String)
    updated_at = Column(String)


class DBAssignmentFeedback(Base):
    __tablename__ = "assignment_feedback"

    id = Column(String, primary_key=True)
    submission_id = Column(String, nullable=False)
    structure_feedback = Column(Text, default="[]")
    logic_feedback = Column(Text, default="[]")
    writing_feedback = Column(Text, default="[]")
    rubric_reference = Column(Text, default="[]")
    summary = Column(Text, default="")
    teacher_note = Column(Text, default="")
    created_at = Column(String)


class DBSurveyTemplate(Base):
    __tablename__ = "survey_templates"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    questions_json = Column(Text, default="[]")
    created_at = Column(String)


class DBSurveyInstance(Base):
    __tablename__ = "survey_instances"

    id = Column(String, primary_key=True)
    lesson_pack_id = Column(String, nullable=False)
    course_id = Column(String, nullable=False)
    template_id = Column(String, nullable=False)
    title = Column(String, default="课后匿名反馈")
    status = Column(String, default="open")
    trigger_mode = Column(String, default="manual")
    created_at = Column(String)


class DBSurveyResponse(Base):
    __tablename__ = "survey_responses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    survey_instance_id = Column(String, nullable=False)
    student_id = Column(String, default="")
    submitted = Column(Integer, default=0)
    skipped = Column(Integer, default=0)
    answers_json = Column(Text, default="{}")
    created_at = Column(String)


class DBMaterialUpdateJob(Base):
    __tablename__ = "material_update_jobs"

    id = Column(String, primary_key=True)
    teacher_id = Column(String, nullable=False)
    course_id = Column(String, default="")
    title = Column(String, default="PPT / 教案更新")
    source_filename = Column(String, default="")
    source_file_path = Column(String, default="")
    instructions = Column(Text, default="")
    selected_model = Column(String, default="default")
    used_model_name = Column(String, default="")
    model_status = Column(String, default="ok")
    result_summary = Column(Text, default="")
    result_outline = Column(Text, default="[]")
    result_pages = Column(Text, default="[]")
    image_suggestions = Column(Text, default="[]")
    created_at = Column(String)


class DBMaterial(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    content = Column(Text, default="")
    file_type = Column(String, default="")
    file_path = Column(String, default="")
    uploader_user_id = Column(String, default="")
    file_size = Column(Integer, default=0)
    share_scope = Column(String, default="private")
    allow_student_view = Column(Integer, default=1)
    allow_classroom_share = Column(Integer, default=1)
    allow_request = Column(Integer, default=1)
    class_name = Column(String, default="")
    has_saved_annotation = Column(Integer, default=0)
    created_at = Column(String)


class DBClassroomShare(Base):
    __tablename__ = "classroom_shares"

    id = Column(String, primary_key=True)
    course_id = Column(String, nullable=False)
    teacher_id = Column(String, nullable=False)
    title = Column(String, default="课堂资料共享")
    description = Column(Text, default="")
    material_ids_json = Column(Text, default="[]")
    share_scope = Column(String, default="classroom")
    share_type = Column(String, default="material")
    status = Column(String, default="active")
    created_at = Column(String)


class DBMaterialShareRecord(Base):
    __tablename__ = "material_share_records"

    id = Column(String, primary_key=True)
    material_id = Column(Integer, nullable=False)
    course_id = Column(String, default="")
    shared_by_teacher_id = Column(String, nullable=False)
    share_target_type = Column(String, default="course_class")
    share_target_id = Column(String, default="")
    is_active = Column(Integer, default=1)
    current_page = Column(Integer, default=1)
    started_at = Column(String)
    ended_at = Column(String, default="")


class DBMaterialRequest(Base):
    __tablename__ = "material_requests"

    id = Column(String, primary_key=True)
    material_id = Column(Integer, default=0)
    course_id = Column(String, nullable=False)
    class_name = Column(String, default="")
    student_id = Column(String, nullable=False)
    request_text = Column(Text, default="")
    anonymous = Column(Integer, default=0)
    status = Column(String, default="pending")
    created_at = Column(String)
    handled_at = Column(String, default="")
    handled_by = Column(String, default="")


class DBMaterialAnnotation(Base):
    __tablename__ = "material_annotations"

    id = Column(String, primary_key=True)
    material_id = Column(Integer, nullable=False)
    share_record_id = Column(String, nullable=False)
    page_no = Column(Integer, default=1)
    tool_type = Column(String, default="pen")
    color = Column(String, default="#ef4444")
    line_width = Column(Integer, default=4)
    points_data = Column(Text, default="[]")
    is_temporary = Column(Integer, default=0)
    expires_at = Column(String, default="")
    created_by = Column(String, default="")
    created_at = Column(String)


class DBSavedAnnotationVersion(Base):
    __tablename__ = "saved_annotation_versions"

    id = Column(String, primary_key=True)
    material_id = Column(Integer, nullable=False)
    share_record_id = Column(String, nullable=False)
    saved_by = Column(String, nullable=False)
    version_name = Column(String, default="")
    save_mode = Column(String, default="save")
    annotation_ids_json = Column(Text, default="[]")
    created_at = Column(String)


class DBQALog(Base):
    __tablename__ = "qa_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lesson_pack_id = Column(String, nullable=False)
    student_id = Column(String, default="")
    student_name = Column(String, default="")
    student_grade = Column(String, default="")
    student_major = Column(String, default="")
    student_gender = Column(String, default="")
    is_anonymous = Column(Integer, default=0)
    question = Column(Text, nullable=False)
    answer = Column(Text, default="")
    in_scope = Column(Integer, default=1)
    created_at = Column(String)


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

    from .security import hash_password
    from .services.mock_data import get_demo_course, get_demo_lesson_pack
    import json
    from uuid import uuid4

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
            db.add_all([
                DBStudent(id="student-demo-001", name="李明", grade="2023级", major="计算机科学与技术", gender="男", created_at=datetime.now().isoformat()),
                DBStudent(id="student-demo-002", name="王悦", grade="2022级", major="软件工程", gender="女", created_at=datetime.now().isoformat()),
            ])

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
            db.add(DBUserProfile(
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
            ))
        if not db.query(DBUserProfile).filter(DBUserProfile.user_id == "user-student-demo").first():
            db.add(DBUserProfile(
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
            ))
        if not db.query(DBUserProfile).filter(DBUserProfile.user_id == "user-admin-demo").first():
            db.add(DBUserProfile(
                user_id="user-admin-demo",
                real_name="系统管理员",
                college="平台运维中心",
                email="admin_demo@example.com",
                phone="13800000003",
                bio="负责全站用户、课程与讨论空间管理。",
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat(),
            ))

        demo_course = db.query(DBCourse).filter(DBCourse.id == "demo-course-001").first()
        if demo_course and not demo_course.owner_user_id:
            demo_course.owner_user_id = "user-teacher-demo"
        if demo_course and not demo_course.class_name:
            demo_course.class_name = "计科2301班"

        if demo_course and not db.query(DBCourseClass).filter(DBCourseClass.course_id == demo_course.id, DBCourseClass.class_name == "计科2301班").first():
            space_id = "space-demo-001"
            if not db.query(DBDiscussionSpace).filter(DBDiscussionSpace.id == space_id).first():
                db.add(DBDiscussionSpace(
                    id=space_id,
                    course_id=demo_course.id,
                    class_name="计科2301班",
                    space_name="计算机网络-计科2301班讨论空间",
                    ai_assistant_enabled=1,
                    created_at=datetime.now().isoformat(),
                ))
            db.add(DBCourseClass(
                id="course-class-demo-001",
                course_id=demo_course.id,
                class_name="计科2301班",
                discussion_space_id=space_id,
                created_at=datetime.now().isoformat(),
            ))
            db.flush()
            existing_members = db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == space_id).count()
            if existing_members == 0:
                db.add_all([
                    DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space_id, user_id="user-teacher-demo", role_in_space="teacher", joined_at=datetime.now().isoformat()),
                    DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space_id, user_id="user-student-demo", role_in_space="student", joined_at=datetime.now().isoformat()),
                    DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space_id, user_id="ai-course-assistant", role_in_space="ai", joined_at=datetime.now().isoformat()),
                ])
            if db.query(DBDiscussionMessage).filter(DBDiscussionMessage.space_id == space_id).count() == 0:
                db.add_all([
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
                ])

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
            db.add(DBSurveyTemplate(id="survey-template-default", name="课堂匿名反馈模板", description="用于课程结束后的匿名课堂反馈", questions_json=json.dumps(default_questions, ensure_ascii=False), created_at=datetime.now().isoformat()))

        if db.query(DBWeaknessAnalysis).count() == 0:
            db.add(DBWeaknessAnalysis(id=f"weak-{uuid4().hex[:8]}", user_id="user-student-demo", course_id="demo-course-001", weak_points_json="[]", suggestions_json="[]", summary="当前尚未生成诊断结果。", updated_at=datetime.now().isoformat()))

        db.commit()
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

