from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class AgentConfigUpdate(BaseModel):
    course_id: str
    scope_rules: str = ""
    answer_style: str = "讲解型"
    enable_homework_support: bool = True
    enable_material_qa: bool = True
    enable_frontier_extension: bool = True


class AgentConfig(AgentConfigUpdate):
    updated_at: str


class CourseCreate(BaseModel):
    name: str
    audience: str = ""
    class_name: str = ""
    term: str = ""
    student_level: str = ""
    chapter: str = ""
    objectives: str = ""
    duration_minutes: int = 90
    frontier_direction: str = ""


class CourseClassBinding(BaseModel):
    id: str
    course_id: str
    class_name: str
    term: str = ""
    discussion_space_id: str = ""
    invite_code: str = ""
    invite_link: str = ""


class CourseMemberSummary(BaseModel):
    user_id: str
    display_name: str
    role: str
    class_name: str = ""
    status: str = "active"
    joined_at: str = ""


class Course(CourseCreate):
    id: str
    owner_user_id: str = ""
    invite_code: str = ""
    teacher_name: str = ""
    discussion_space_count: int = 0
    bound_classes: list[CourseClassBinding] = Field(default_factory=list)
    member_count: int = 0
    student_count: int = 0
    joined: bool = False
    created_at: str


class TeacherCourseManagementDetail(Course):
    members: list[CourseMemberSummary] = Field(default_factory=list)


class CourseClassCreate(BaseModel):
    class_name: str
    term: str = ""


class CourseJoinRequest(BaseModel):
    invite_code: str
    class_name: str = ""


class CourseCatalogItem(BaseModel):
    course_id: str
    course_name: str
    teacher_name: str = ""
    term: str = ""
    class_options: list[str] = Field(default_factory=list)


class LessonPack(BaseModel):
    id: str
    course_id: str
    version: int = 1
    status: str = "draft"
    payload: dict = Field(default_factory=dict)
    created_at: str


class LessonPackUpdate(BaseModel):
    payload: Optional[dict] = None
    status: Optional[str] = None


class ModelOption(BaseModel):
    key: str
    label: str
    provider: str
    model_name: str
    supports_vision: bool = False
    is_default: bool = False
    description: str = ""
    availability_note: str = ""
