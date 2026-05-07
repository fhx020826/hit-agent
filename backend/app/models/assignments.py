from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class AssignmentCreate(BaseModel):
    course_id: str
    offering_id: str = ""
    title: str
    description: str = ""
    target_class: str = ""
    deadline: str = ""
    attachment_requirements: str = ""
    submission_format: str = ""
    grading_notes: str = ""
    allow_resubmit: bool = True
    enable_ai_feedback: bool = True
    remind_days: int = 1


class AssignmentSummary(BaseModel):
    id: str
    teacher_id: str
    course_id: str
    offering_id: str = ""
    title: str
    description: str
    target_class: str
    deadline: str
    attachment_requirements: str
    submission_format: str
    grading_notes: str
    allow_resubmit: bool
    enable_ai_feedback: bool
    remind_days: int
    status: str
    created_at: str


class AssignmentReceiptStatus(BaseModel):
    assignment_id: str
    confirmed: bool
    confirmed_at: str = ""


class AssignmentSubmissionItem(BaseModel):
    file_name: str
    file_type: str
    file_size: int
    download_url: str


class AssignmentSubmissionSummary(BaseModel):
    id: str
    assignment_id: str
    student_id: str
    status: str
    submitted_at: str
    resubmitted_count: int
    files: List[AssignmentSubmissionItem] = Field(default_factory=list)


class AssignmentFeedbackSummary(BaseModel):
    summary: str
    structure_feedback: List[str] = Field(default_factory=list)
    logic_feedback: List[str] = Field(default_factory=list)
    writing_feedback: List[str] = Field(default_factory=list)
    rubric_reference: List[str] = Field(default_factory=list)
    teacher_note: str
    created_at: str


class AssignmentStudentView(BaseModel):
    assignment: AssignmentSummary
    receipt: AssignmentReceiptStatus
    submission: Optional[AssignmentSubmissionSummary] = None
    feedback: Optional[AssignmentFeedbackSummary] = None


class AssignmentTeacherRosterItem(BaseModel):
    user_id: str
    display_name: str
    class_name: str
    confirmed: bool
    confirmed_at: str = ""
    submitted: bool
    submitted_at: str = ""


class AssignmentTeacherDetail(BaseModel):
    assignment: AssignmentSummary
    submitted_students: List[AssignmentTeacherRosterItem] = Field(default_factory=list)
    unsubmitted_students: List[AssignmentTeacherRosterItem] = Field(default_factory=list)
    confirmed_but_unsubmitted: List[AssignmentTeacherRosterItem] = Field(default_factory=list)
    unconfirmed_students: List[AssignmentTeacherRosterItem] = Field(default_factory=list)


class AssignmentReviewRequest(BaseModel):
    course_id: str = ""
    assignment_type: str = "作业"
    title: str
    requirements: str = ""
    submission_text: str


class AssignmentReviewResponse(BaseModel):
    summary: str
    structure_feedback: List[str] = Field(default_factory=list)
    logic_feedback: List[str] = Field(default_factory=list)
    writing_feedback: List[str] = Field(default_factory=list)
    rubric_reference: List[str] = Field(default_factory=list)
    teacher_note: str
