"""资料、共享与课堂批注相关 ORM 模型。"""

from __future__ import annotations

from sqlalchemy import Column, Index, Integer, Text
from sqlalchemy.sql.sqltypes import String

from .session import Base


class DBMaterialUpdateJob(Base):
    __tablename__ = "material_update_jobs"

    id = Column(String, primary_key=True)
    teacher_id = Column(String, nullable=False)
    course_id = Column(String, default="")
    title = Column(String, default="PPT / 教案更新")
    source_filename = Column(String, default="")
    source_file_path = Column(String, default="")
    instructions = Column(Text, default="")
    selected_model = Column(String, default="default")
    used_model_name = Column(String, default="")
    model_status = Column(String, default="ok")
    result_summary = Column(Text, default="")
    result_outline = Column(Text, default="[]")
    result_pages = Column(Text, default="[]")
    image_suggestions = Column(Text, default="[]")
    created_at = Column(String)


class DBMaterial(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    content = Column(Text, default="")
    file_type = Column(String, default="")
    file_path = Column(String, default="")
    uploader_user_id = Column(String, default="")
    file_size = Column(Integer, default=0)
    share_scope = Column(String, default="private")
    allow_student_view = Column(Integer, default=1)
    allow_classroom_share = Column(Integer, default=1)
    allow_request = Column(Integer, default=1)
    class_name = Column(String, default="")
    has_saved_annotation = Column(Integer, default=0)
    created_at = Column(String)


class DBKnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    __table_args__ = (
        Index("idx_knowledge_chunks_course_id", "course_id"),
        Index("idx_knowledge_chunks_source", "source_type", "source_id"),
        Index("idx_knowledge_chunks_updated_at", "updated_at"),
    )

    id = Column(String, primary_key=True)
    course_id = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    source_id = Column(String, nullable=False)
    source_name = Column(String, default="")
    chunk_index = Column(Integer, default=0)
    chunk_text = Column(Text, default="")
    keywords_json = Column(Text, default="[]")
    embedding_json = Column(Text, default="")
    embedding_model = Column(String, default="")
    embedding_updated_at = Column(String, default="")
    meta_json = Column(Text, default="{}")
    created_at = Column(String)
    updated_at = Column(String)


class DBClassroomShare(Base):
    __tablename__ = "classroom_shares"

    id = Column(String, primary_key=True)
    course_id = Column(String, nullable=False)
    teacher_id = Column(String, nullable=False)
    title = Column(String, default="课堂资料共享")
    description = Column(Text, default="")
    material_ids_json = Column(Text, default="[]")
    share_scope = Column(String, default="classroom")
    share_type = Column(String, default="material")
    status = Column(String, default="active")
    created_at = Column(String)


class DBMaterialShareRecord(Base):
    __tablename__ = "material_share_records"

    id = Column(String, primary_key=True)
    material_id = Column(Integer, nullable=False)
    course_id = Column(String, default="")
    shared_by_teacher_id = Column(String, nullable=False)
    share_target_type = Column(String, default="course_class")
    share_target_id = Column(String, default="")
    is_active = Column(Integer, default=1)
    current_page = Column(Integer, default=1)
    started_at = Column(String)
    ended_at = Column(String, default="")


class DBMaterialRequest(Base):
    __tablename__ = "material_requests"

    id = Column(String, primary_key=True)
    material_id = Column(Integer, default=0)
    course_id = Column(String, nullable=False)
    class_name = Column(String, default="")
    student_id = Column(String, nullable=False)
    request_text = Column(Text, default="")
    anonymous = Column(Integer, default=0)
    status = Column(String, default="pending")
    created_at = Column(String)
    handled_at = Column(String, default="")
    handled_by = Column(String, default="")


class DBMaterialAnnotation(Base):
    __tablename__ = "material_annotations"

    id = Column(String, primary_key=True)
    material_id = Column(Integer, nullable=False)
    share_record_id = Column(String, nullable=False)
    page_no = Column(Integer, default=1)
    tool_type = Column(String, default="pen")
    color = Column(String, default="#ef4444")
    line_width = Column(Integer, default=4)
    points_data = Column(Text, default="[]")
    is_temporary = Column(Integer, default=0)
    expires_at = Column(String, default="")
    created_by = Column(String, default="")
    created_at = Column(String)


class DBSavedAnnotationVersion(Base):
    __tablename__ = "saved_annotation_versions"

    id = Column(String, primary_key=True)
    material_id = Column(Integer, nullable=False)
    share_record_id = Column(String, nullable=False)
    saved_by = Column(String, nullable=False)
    version_name = Column(String, default="")
    save_mode = Column(String, default="save")
    annotation_ids_json = Column(Text, default="[]")
    created_at = Column(String)
