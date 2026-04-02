"""数据模型定义：所有核心实体的 Pydantic schema。"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── 课程画像 ──────────────────────────────────────────────

class CourseCreate(BaseModel):
    name: str = Field(..., description="课程名称")
    audience: str = Field("", description="授课对象")
    student_level: str = Field("", description="学生水平")
    chapter: str = Field("", description="当前章节")
    objectives: str = Field("", description="课程目标")
    duration_minutes: int = Field(90, description="课时时长(分钟)")
    frontier_direction: str = Field("", description="拟引入的前沿方向")


class Course(CourseCreate):
    id: str
    created_at: datetime = Field(default_factory=datetime.now)


# ── 课时包 ────────────────────────────────────────────────

class LessonPack(BaseModel):
    id: str
    course_id: str
    version: int = 1
    status: str = "draft"  # draft / published
    payload: dict = Field(default_factory=dict, description="课时包结构化内容")
    created_at: datetime = Field(default_factory=datetime.now)


class LessonPackUpdate(BaseModel):
    payload: Optional[dict] = None
    status: Optional[str] = None


# ── 学生问答 ──────────────────────────────────────────────

class StudentQuestion(BaseModel):
    lesson_pack_id: str
    question: str


class QAResponse(BaseModel):
    answer: str
    evidence: list[str] = Field(default_factory=list, description="回答依据片段")
    in_scope: bool = Field(True, description="是否在课程边界内")


# ── 教师复盘 ──────────────────────────────────────────────

class AnalyticsReport(BaseModel):
    lesson_pack_id: str
    total_questions: int = 0
    high_freq_topics: list[str] = Field(default_factory=list)
    confused_concepts: list[str] = Field(default_factory=list)
    knowledge_gaps: list[str] = Field(default_factory=list)
    teaching_suggestions: list[str] = Field(default_factory=list)
