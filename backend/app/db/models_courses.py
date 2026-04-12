"""课程与课程包相关 ORM 模型。"""

from __future__ import annotations

from sqlalchemy import Column, Integer, Text
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


class DBCourseClass(Base):
    __tablename__ = "course_classes"

    id = Column(String, primary_key=True)
    course_id = Column(String, nullable=False)
    class_name = Column(String, nullable=False)
    discussion_space_id = Column(String, default="")
    created_at = Column(String)
