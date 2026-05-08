from __future__ import annotations

import json
import logging
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Callable
from uuid import uuid4

from sqlalchemy.orm import Session, sessionmaker

from ..db.models_tasks import DBTaskJob
from ..db.session import SessionLocal
from .task_job_handlers import TASK_JOB_HANDLERS

logger = logging.getLogger(__name__)

TaskJobHandler = Callable[[Session, DBTaskJob, dict], dict]


def _now() -> str:
    return datetime.now().isoformat()


class TaskJobService:
    def __init__(
        self,
        *,
        session_factory: sessionmaker = SessionLocal,
        max_workers: int | None = None,
        handlers: dict[str, TaskJobHandler] | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._handlers = handlers or TASK_JOB_HANDLERS
        self._max_workers = max(1, int(max_workers or os.getenv("HIT_AGENT_TASK_WORKERS", "2")))
        self._executor: ThreadPoolExecutor | None = None
        self._lock = threading.Lock()
        self._scheduled_job_ids: set[str] = set()

    def start(self) -> None:
        with self._lock:
            if self._executor is not None:
                return
            self._executor = ThreadPoolExecutor(
                max_workers=self._max_workers,
                thread_name_prefix="hit-agent-task",
            )
        self.recover_incomplete_jobs()

    def shutdown(self) -> None:
        with self._lock:
            executor = self._executor
            self._executor = None
            self._scheduled_job_ids.clear()
        if executor is not None:
            executor.shutdown(wait=True, cancel_futures=True)

    def create_job(
        self,
        db: Session,
        *,
        job_type: str,
        owner_user_id: str,
        owner_role: str,
        course_id: str = "",
        input_payload: dict | None = None,
        message: str = "",
    ) -> DBTaskJob:
        now = _now()
        row = DBTaskJob(
            id=f"task-{uuid4().hex[:10]}",
            job_type=job_type,
            owner_user_id=owner_user_id,
            owner_role=owner_role,
            course_id=course_id,
            status="queued",
            progress=0,
            message=message or "任务已进入队列。",
            input_json=json.dumps(input_payload or {}, ensure_ascii=False),
            result_json="{}",
            error_message="",
            created_at=now,
            updated_at=now,
            started_at="",
            finished_at="",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        self.schedule(row.id)
        return row

    def recover_incomplete_jobs(self) -> None:
        db = self._session_factory()
        try:
            now = _now()
            stale_jobs = (
                db.query(DBTaskJob)
                .filter(DBTaskJob.status.in_(("queued", "running")))
                .all()
            )
            for row in stale_jobs:
                row.status = "failed"
                row.progress = 100
                row.message = "任务因服务重启被中断，请重新提交。"
                row.error_message = "服务重启，后台任务未继续执行。"
                row.finished_at = now
                row.updated_at = now
            if stale_jobs:
                db.commit()
        finally:
            db.close()

    def schedule(self, job_id: str) -> None:
        with self._lock:
            executor = self._executor
            if executor is None:
                raise RuntimeError("任务中心尚未启动")
            if job_id in self._scheduled_job_ids:
                return
            self._scheduled_job_ids.add(job_id)
        executor.submit(self._run_job, job_id)

    def _run_job(self, job_id: str) -> None:
        try:
            db = self._session_factory()
            try:
                row = db.query(DBTaskJob).filter(DBTaskJob.id == job_id).first()
                if row is None or row.status not in {"queued", "running"}:
                    return

                handler = self._handlers.get(row.job_type)
                if handler is None:
                    raise RuntimeError(f"未注册的任务类型：{row.job_type}")

                now = _now()
                row.status = "running"
                row.progress = max(row.progress, 15)
                row.message = row.message or "任务执行中。"
                row.started_at = row.started_at or now
                row.updated_at = now
                db.commit()

                payload = json.loads(row.input_json or "{}")
                result = handler(db, row, payload)

                completed_at = _now()
                row.status = "succeeded"
                row.progress = 100
                row.message = str(result.get("message") or "任务执行完成。")
                row.result_json = json.dumps(result, ensure_ascii=False)
                row.error_message = ""
                row.finished_at = completed_at
                row.updated_at = completed_at
                db.commit()
            finally:
                db.close()
        except Exception as exc:  # noqa: BLE001
            logger.exception("Task job failed: %s", job_id)
            self._mark_job_failed(job_id, str(exc))
        finally:
            with self._lock:
                self._scheduled_job_ids.discard(job_id)

    def _mark_job_failed(self, job_id: str, error_message: str) -> None:
        db = self._session_factory()
        try:
            row = db.query(DBTaskJob).filter(DBTaskJob.id == job_id).first()
            if row is None:
                return
            now = _now()
            row.status = "failed"
            row.progress = 100
            row.message = "任务执行失败。"
            row.error_message = error_message
            row.finished_at = now
            row.updated_at = now
            db.commit()
        finally:
            db.close()
