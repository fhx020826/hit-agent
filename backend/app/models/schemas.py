from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

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


class AuthRegisterRequest(BaseModel):
    role: RoleType
    account: str
    password: str
    confirm_password: str
    profile: UserProfileBase


class AuthLoginRequest(BaseModel):
    role: RoleType
    account: str
    password: str


class AuthLoginResponse(BaseModel):
    token: str
    user: UserSummary


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


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class AvatarUploadResponse(BaseModel):
    avatar_path: str
    updated_at: str


class MaterialItem(BaseModel):
    id: int
    filename: str
    file_type: str
    created_at: str
    download_url: str
    size: int = 0


class MaterialUploadResponse(MaterialItem):
    message: str = "上传成功"


class ClassroomShareCreate(BaseModel):
    course_id: str
    material_ids: List[int] = Field(default_factory=list)
    title: str = "课堂资料共享"
    description: str = ""
    share_scope: str = "classroom"
    share_type: str = "material"


class ClassroomShare(BaseModel):
    id: str
    course_id: str
    teacher_id: str
    title: str
    description: str
    share_scope: str
    share_type: str
    status: str
    created_at: str
    materials: List[MaterialItem] = Field(default_factory=list)


class MaterialRequestCreate(BaseModel):
    course_id: str
    request_text: str = ""


class MaterialRequestItem(BaseModel):
    id: str
    course_id: str
    student_id: str
    student_name: str
    anonymous: bool = False
    request_text: str
    status: str
    created_at: str


class CourseClassItem(BaseModel):
    id: str
    course_id: str
    class_name: str
    discussion_space_id: str = ""


class DiscussionSpaceSummary(BaseModel):
    id: str
    course_id: str
    class_name: str
    space_name: str
    ai_assistant_enabled: bool = True
    member_count: int = 0
    created_at: str


class DiscussionMemberItem(BaseModel):
    user_id: str
    display_name: str
    role_in_space: str
    avatar_path: str = ""
    joined_at: str


class DiscussionAttachment(BaseModel):
    id: str
    file_name: str
    file_type: str
    file_size: int
    parse_status: str
    created_at: str
    download_url: str


class DiscussionMessageCreate(BaseModel):
    space_id: str
    content: str = ""
    is_anonymous: bool = False
    mention_ai: bool = False
    attachment_ids: List[str] = Field(default_factory=list)


class DiscussionMessageItem(BaseModel):
    id: str
    space_id: str
    sender_user_id: str
    sender_type: str
    sender_display_name: str
    sender_avatar_path: str = ""
    is_anonymous: bool = False
    message_type: str = "text"
    content: str = ""
    reply_to_message_id: str = ""
    created_at: str
    has_attachments: bool = False
    attachments: List[DiscussionAttachment] = Field(default_factory=list)
    ai_sources: List[str] = Field(default_factory=list)
    can_locate: bool = True


class DiscussionSpaceDetail(DiscussionSpaceSummary):
    course_name: str = ""
    members: List[DiscussionMemberItem] = Field(default_factory=list)
    recent_materials: List[MaterialItem] = Field(default_factory=list)


class DiscussionSearchResult(BaseModel):
    items: List[DiscussionMessageItem] = Field(default_factory=list)
    page: int = 1
    page_size: int = 20
    total: int = 0


class DiscussionContextResponse(BaseModel):
    anchor_message_id: str
    messages: List[DiscussionMessageItem] = Field(default_factory=list)


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


class LiveShareRecord(BaseModel):
    id: str
    material_id: int
    course_id: str
    shared_by_teacher_id: str
    share_target_type: str
    share_target_id: str
    is_active: bool
    current_page: int = 1
    started_at: str
    ended_at: str = ""


class LiveShareStartRequest(BaseModel):
    material_id: int
    share_target_type: str = "course_class"
    share_target_id: str = ""


class LiveSharePageUpdate(BaseModel):
    current_page: int = 1


class AnnotationStrokeCreate(BaseModel):
    page_no: int = 1
    tool_type: str = "pen"
    color: str = "#ef4444"
    line_width: int = 4
    points_data: List[Dict[str, Any]] = Field(default_factory=list)
    is_temporary: bool = False
    expires_in_seconds: int = 8


class AnnotationStroke(BaseModel):
    id: str
    material_id: int
    share_record_id: str
    page_no: int
    tool_type: str
    color: str
    line_width: int
    points_data: List[Dict[str, Any]] = Field(default_factory=list)
    is_temporary: bool = False
    created_by: str
    created_at: str
    expires_at: str = ""


class LiveShareCloseRequest(BaseModel):
    save_mode: str = "discard"
    version_name: str = ""


class SavedAnnotationVersionItem(BaseModel):
    id: str
    material_id: int
    share_record_id: str
    saved_by: str
    version_name: str
    save_mode: str
    created_at: str


class WeaknessAnalysisResponse(BaseModel):
    course_id: str = ""
    course_name: str = ""
    total_questions: int = 0
    summary: str
    weak_points: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    updated_at: str


class AssignmentCreate(BaseModel):
    course_id: str
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


class MaterialUpdateResult(BaseModel):
    id: str
    title: str
    summary: str
    update_suggestions: List[str] = Field(default_factory=list)
    draft_pages: List[str] = Field(default_factory=list)
    image_suggestions: List[str] = Field(default_factory=list)
    selected_model: str = "default"
    used_model_name: str = ""
    model_status: str = "ok"
    created_at: str


class MaterialUpdatePreviewRequest(BaseModel):
    course_id: str = ""
    title: str = "PPT / 教案更新"
    instructions: str = ""
    material_text: str = ""
    selected_model: str = "default"


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
    total_questions: int = 0
    anonymous_questions: int = 0
    identified_questions: int = 0
    high_freq_topics: List[str] = Field(default_factory=list)
    confused_concepts: List[str] = Field(default_factory=list)
    knowledge_gaps: List[str] = Field(default_factory=list)
    teaching_suggestions: List[str] = Field(default_factory=list)
    recent_questions: List[Dict[str, Any]] = Field(default_factory=list)


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
