"""问卷与反馈相关 ORM 模型。"""

from __future__ import annotations

from sqlalchemy import Column, Integer, Text
from sqlalchemy.sql.sqltypes import String

from .session import Base


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
