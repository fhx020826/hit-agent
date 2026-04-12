from __future__ import annotations

from pydantic import BaseModel, Field

from .common import RoleType, UserProfileBase


class TeacherCreate(BaseModel):
    name: str
    department: str = ""
    title: str = ""
    gender: str = ""


class Teacher(TeacherCreate):
    id: str
    created_at: str


class StudentCreate(BaseModel):
    name: str
    grade: str = ""
    major: str = ""
    gender: str = ""


class Student(StudentCreate):
    id: str
    created_at: str


class AdminUserItem(BaseModel):
    id: str
    role: RoleType
    account: str
    display_name: str
    status: str
    created_at: str
    class_name: str = ""
    college: str = ""
    major: str = ""
    email: str = ""


class AdminUserCreate(BaseModel):
    role: RoleType
    account: str
    password: str
    display_name: str = ""
    status: str = "active"
    profile: UserProfileBase = Field(default_factory=UserProfileBase)


class AdminUserUpdate(BaseModel):
    display_name: str = ""
    status: str = "active"
    profile: UserProfileBase = Field(default_factory=UserProfileBase)
