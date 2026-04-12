from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from .common import AnswerTargetType, TeacherReplyStatus


class UploadedAttachment(BaseModel):
    id: str
    file_name: str
    file_type: str
    file_size: int
    parse_status: str
    parse_summary: str
    created_at: str
    download_url: str


class ChatSessionCreate(BaseModel):
    course_id: str
    lesson_pack_id: str = ""
    title: str = ""
    selected_model: str = "default"


class ChatSessionSummary(BaseModel):
    id: str
    course_id: str
    lesson_pack_id: str
    title: str
    selected_model: str
    created_at: str
    updated_at: str


class QuestionFolderCreate(BaseModel):
    course_id: str
    name: str
    description: str = ""


class QuestionFolderUpdate(BaseModel):
    name: str
    description: str = ""


class QuestionFolderAssign(BaseModel):
    folder_id: str = ""


class QuestionFolderItem(BaseModel):
    id: str
    course_id: str
    name: str
    description: str = ""
    question_count: int = 0
    created_at: str
    updated_at: str


class StudentQuestionCreate(BaseModel):
    session_id: str
    course_id: str
    lesson_pack_id: str = ""
    question: str = ""
    answer_target_type: AnswerTargetType = "ai"
    anonymous: bool = False
    selected_model: str = "default"
    attachment_ids: List[str] = Field(default_factory=list)


class QuestionRecord(BaseModel):
    id: str
    session_id: str
    course_id: str
    lesson_pack_id: str
    question_text: str
    answer_target_type: AnswerTargetType
    selected_model: str
    anonymous: bool
    status: str
    teacher_reply_status: str
    ai_answer_content: str
    ai_answer_time: str
    ai_answer_sources: List[str] = Field(default_factory=list)
    teacher_answer_content: str
    teacher_answer_time: str
    has_attachments: bool
    attachment_count: int
    input_mode: str
    collected: bool = False
    folder_id: str = ""
    folder_name: str = ""
    created_at: str
    updated_at: str
    attachment_items: List[UploadedAttachment] = Field(default_factory=list)
    asker_display_name: str = ""
    asker_class_name: str = ""


class ChatSessionDetail(ChatSessionSummary):
    questions: List[QuestionRecord] = Field(default_factory=list)


class TeacherReplyRequest(BaseModel):
    reply_content: str
    status: TeacherReplyStatus = "replied"


class TeacherNotification(BaseModel):
    id: str
    message_type: str
    related_question_id: str
    title: str
    content: str
    is_read: bool
    created_at: str


class WeaknessAnalysisResponse(BaseModel):
    course_id: str = ""
    course_name: str = ""
    total_questions: int = 0
    summary: str
    weak_points: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    updated_at: str


class StudentQuestion(BaseModel):
    question: str
    student_id: Optional[str] = None
    anonymous: bool = False


class QAResponse(BaseModel):
    answer: str
    evidence: List[str] = Field(default_factory=list)
    in_scope: bool = True


class QuestionLogSummary(BaseModel):
    created_at: str
    question: str
    in_scope: bool
    anonymous: bool
    student_display_name: str
    student_grade: str = ""
    student_major: str = ""
