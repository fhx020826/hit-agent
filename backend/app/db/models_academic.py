from __future__ import annotations

from sqlalchemy import Column, Integer, Text
from sqlalchemy.sql.sqltypes import String

from .session import Base


class DBSchoolClass(Base):
    __tablename__ = "school_classes"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    college = Column(String, default="")
    major = Column(String, default="")
    grade = Column(String, default="")
    year = Column(String, default="")
    status = Column(String, default="active")
    created_at = Column(String)
    updated_at = Column(String)


class DBAcademicCourse(Base):
    __tablename__ = "academic_courses"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    code = Column(String, default="", unique=True)
    description = Column(Text, default="")
    credit = Column(String, default="")
    department = Column(String, default="")
    status = Column(String, default="active")
    created_at = Column(String)
    updated_at = Column(String)


class DBCourseOffering(Base):
    __tablename__ = "course_offerings"

    id = Column(String, primary_key=True)
    academic_course_id = Column(String, nullable=False)
    course_id = Column(String, default="")
    teacher_user_id = Column(String, nullable=False)
    class_id = Column(String, nullable=False)
    semester = Column(String, default="")
    invite_code = Column(String, default="", unique=True)
    join_enabled = Column(Integer, default=1)
    discussion_space_id = Column(String, default="")
    status = Column(String, default="active")
    created_at = Column(String)
    updated_at = Column(String)


class DBCourseEnrollment(Base):
    __tablename__ = "course_enrollments"

    id = Column(String, primary_key=True)
    offering_id = Column(String, nullable=False)
    student_user_id = Column(String, nullable=False)
    class_id = Column(String, default="")
    source = Column(String, default="admin")
    status = Column(String, default="active")
    joined_at = Column(String, default="")
    created_at = Column(String)
