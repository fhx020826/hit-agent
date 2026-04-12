from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, Field

RoleType = Literal["admin", "teacher", "student"]
AnswerTargetType = Literal["ai", "teacher", "both"]
TeacherReplyStatus = Literal["not_requested", "pending", "replied", "closed"]
QuestionStatus = Literal["submitted", "ai_answered", "teacher_pending", "teacher_replied", "closed"]


class AppearanceSettingBase(BaseModel):
    mode: str = Field(default="day")
    accent: str = Field(default="blue")
    font: str = Field(default="default")
    skin: str = Field(default="clean")
    language: str = Field(default="zh-CN")


class AppearanceSetting(AppearanceSettingBase):
    user_role: str
    user_id: str
    updated_at: str


class UserProfileBase(BaseModel):
    real_name: str = ""
    gender: str = ""
    college: str = ""
    major: str = ""
    grade: str = ""
    class_name: str = ""
    student_no: str = ""
    teacher_no: str = ""
    department: str = ""
    teaching_group: str = ""
    role_title: str = ""
    birth_date: str = ""
    email: str = ""
    phone: str = ""
    avatar_path: str = ""
    bio: str = ""
    research_direction: str = ""
    interests: str = ""
    common_courses: List[str] = Field(default_factory=list)
    linked_classes: List[str] = Field(default_factory=list)


class UserProfile(UserProfileBase):
    updated_at: str = ""


class UserSummary(BaseModel):
    id: str
    role: RoleType
    account: str
    display_name: str
    status: str
    created_at: str
    profile: UserProfile


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class AvatarUploadResponse(BaseModel):
    avatar_path: str
    updated_at: str
