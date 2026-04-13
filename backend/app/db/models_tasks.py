"""轻量异步任务中心 ORM 模型。"""

from __future__ import annotations

from sqlalchemy import Column, Index, Integer, Text
from sqlalchemy.sql.sqltypes import String

from .session import Base


class DBTaskJob(Base):
    __tablename__ = "task_jobs"
    __table_args__ = (
        Index("idx_task_jobs_owner_created", "owner_user_id", "created_at"),
        Index("idx_task_jobs_status_created", "status", "created_at"),
        Index("idx_task_jobs_type_created", "job_type", "created_at"),
    )

    id = Column(String, primary_key=True)
    job_type = Column(String, nullable=False)
    owner_user_id = Column(String, nullable=False)
    owner_role = Column(String, default="")
    course_id = Column(String, default="")
    status = Column(String, default="queued")
    progress = Column(Integer, default=0)
    message = Column(Text, default="")
    input_json = Column(Text, default="{}")
    result_json = Column(Text, default="{}")
    error_message = Column(Text, default="")
    created_at = Column(String)
    updated_at = Column(String)
    started_at = Column(String, default="")
    finished_at = Column(String, default="")
