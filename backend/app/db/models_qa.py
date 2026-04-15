"""问答、通知与学习分析相关 ORM 模型。"""

from __future__ import annotations

from sqlalchemy import Column, Integer, Text
from sqlalchemy.sql.sqltypes import String

from .session import Base


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
    parent_folder_id = Column(String, default="")
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    created_at = Column(String)
    updated_at = Column(String)


class DBLearningNotebook(Base):
    __tablename__ = "learning_notebooks"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    course_id = Column(String, default="")
    parent_folder_id = Column(String, default="")
    title = Column(String, nullable=False)
    content_text = Column(Text, default="")
    is_starred = Column(Integer, default=0)
    created_at = Column(String)
    updated_at = Column(String)


class DBLearningNotebookImage(Base):
    __tablename__ = "learning_notebook_images"

    id = Column(String, primary_key=True)
    notebook_id = Column(String, nullable=False)
    uploader_user_id = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String, default="")
    file_type = Column(String, default="")
    file_size = Column(Integer, default=0)
    created_at = Column(String)


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
    title = Column(String, default="")
    note = Column(Text, default="")
    parent_folder_id = Column(String, default="")
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
