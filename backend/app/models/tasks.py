from __future__ import annotations

from typing import Any, Dict, Literal

from pydantic import BaseModel, Field

TaskJobStatus = Literal["queued", "running", "succeeded", "failed"]


class TaskJobItem(BaseModel):
    id: str
    job_type: str
    course_id: str = ""
    status: TaskJobStatus = "queued"
    progress: int = 0
    message: str = ""
    error_message: str = ""
    result: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str
    started_at: str = ""
    finished_at: str = ""
