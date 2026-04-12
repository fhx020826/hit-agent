"""身份、用户与外观相关 ORM 模型。"""

from __future__ import annotations

from sqlalchemy import Column, Integer, Text
from sqlalchemy.sql.sqltypes import String

from .session import Base


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
