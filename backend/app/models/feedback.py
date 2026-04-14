from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel, Field


class SurveyTemplate(BaseModel):
    id: str
    name: str
    description: str = ""
    questions: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: str


class SurveyInstanceCreate(BaseModel):
    lesson_pack_id: str
    course_id: str
    template_id: str = "survey-template-default"
    title: str = "课后匿名反馈"
    trigger_mode: str = "manual"


class SurveyInstance(BaseModel):
    id: str
    lesson_pack_id: str
    course_id: str
    template_id: str
    title: str
    status: str
    trigger_mode: str = "manual"
    created_at: str


class SurveyPendingItem(BaseModel):
    id: str
    lesson_pack_id: str
    course_id: str
    title: str
    questions: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: str


class SurveySubmit(BaseModel):
    answers: Dict[str, Any] = Field(default_factory=dict)


class SurveyAnalytics(BaseModel):
    survey_instance_id: str
    title: str
    total_target_students: int
    participation_count: int
    participation_rate: float
    rating_breakdown: Dict[str, Dict[str, int]] = Field(default_factory=dict)
    choice_breakdown: Dict[str, Dict[str, int]] = Field(default_factory=dict)
    text_feedback: List[str] = Field(default_factory=list)


class AnalyticsReport(BaseModel):
    lesson_pack_id: str
    has_data: bool = True
    total_questions: int = 0
    anonymous_questions: int = 0
    identified_questions: int = 0
    high_freq_topics: List[str] = Field(default_factory=list)
    confused_concepts: List[str] = Field(default_factory=list)
    knowledge_gaps: List[str] = Field(default_factory=list)
    teaching_suggestions: List[str] = Field(default_factory=list)
    recent_questions: List[Dict[str, Any]] = Field(default_factory=list)
