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
    student_level: str = ""
    chapter: str = ""
    objectives: str = ""
    duration_minutes: int = 90
    frontier_direction: str = ""


class Course(CourseCreate):
    id: str
    owner_user_id: str = ""
    created_at: str


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
