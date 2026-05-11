from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel, Field


class MaterialItem(BaseModel):
    id: int
    filename: str
    file_type: str
    created_at: str
    download_url: str
    size: int = 0
    page_count: int = 0
    page_aspect_ratio: float | None = None


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


class MaterialUpdateResult(BaseModel):
    id: str
    course_id: str = ""
    title: str
    source_filename: str = ""
    generation_mode: str = "update_existing"
    target_format: str = "ppt"
    summary: str
    update_suggestions: List[str] = Field(default_factory=list)
    draft_pages: List[str] = Field(default_factory=list)
    image_suggestions: List[str] = Field(default_factory=list)
    teaching_flow: List[str] = Field(default_factory=list)
    speaker_notes: List[str] = Field(default_factory=list)
    classroom_interactions: List[str] = Field(default_factory=list)
    assessment_checkpoints: List[str] = Field(default_factory=list)
    delivery_checklist: List[str] = Field(default_factory=list)
    reference_updates: List[str] = Field(default_factory=list)
    selected_model: str = "default"
    used_model_name: str = ""
    model_status: str = "ok"
    generated_file_name: str = ""
    generated_file_type: str = ""
    generated_download_url: str = ""
    created_at: str


class MaterialUpdatePreviewRequest(BaseModel):
    course_id: str = ""
    title: str = "PPT / 教案生成"
    generation_mode: str = "update_existing"
    target_format: str = "ppt"
    instructions: str = ""
    material_text: str = ""
    selected_model: str = "default"
