"""SQLAlchemy ORM models for the teaching platform."""

from __future__ import annotations

from sqlalchemy import Column, Index, Integer, Text
from sqlalchemy.sql.sqltypes import String

from .session import Base


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


class DBKnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    __table_args__ = (
        Index("idx_knowledge_chunks_course_id", "course_id"),
        Index("idx_knowledge_chunks_source", "source_type", "source_id"),
        Index("idx_knowledge_chunks_updated_at", "updated_at"),
    )

    id = Column(String, primary_key=True)
    course_id = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    source_id = Column(String, nullable=False)
    source_name = Column(String, default="")
    chunk_index = Column(Integer, default=0)
    chunk_text = Column(Text, default="")
    keywords_json = Column(Text, default="[]")
    embedding_json = Column(Text, default="")
    embedding_model = Column(String, default="")
    embedding_updated_at = Column(String, default="")
    meta_json = Column(Text, default="{}")
    created_at = Column(String)
    updated_at = Column(String)


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
