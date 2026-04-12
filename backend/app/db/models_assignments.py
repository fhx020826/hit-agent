"""作业相关 ORM 模型。"""

from __future__ import annotations

from sqlalchemy import Column, Integer, Text
from sqlalchemy.sql.sqltypes import String

from .session import Base


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
