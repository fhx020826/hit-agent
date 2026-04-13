from __future__ import annotations

import time
from datetime import datetime


def _login(client, role: str, account: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"role": role, "account": account, "password": password},
    )
    assert response.status_code == 200
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def _wait_for_job(client, headers: dict[str, str], job_id: str, timeout_seconds: float = 6.0) -> dict:
    deadline = time.time() + timeout_seconds
    last_payload: dict | None = None
    while time.time() < deadline:
        response = client.get(f"/api/task-jobs/{job_id}", headers=headers)
        assert response.status_code == 200
        last_payload = response.json()
        if last_payload["status"] in {"succeeded", "failed"}:
            return last_payload
        time.sleep(0.05)
    raise AssertionError(f"任务 {job_id} 在 {timeout_seconds} 秒内未结束，最后状态：{last_payload}")


def test_async_lesson_pack_job_submission_and_polling(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")

    create_course_response = client.post(
        "/api/courses",
        json={
            "name": "异步课程包测试课程",
            "audience": "计科2301班",
            "class_name": "计科2301班",
            "student_level": "本科",
            "chapter": "传输层",
            "objectives": "验证课程包异步生成",
            "duration_minutes": 90,
            "frontier_direction": "智能网络",
        },
        headers=teacher_headers,
    )
    assert create_course_response.status_code == 200
    course_id = create_course_response.json()["id"]

    submit_response = client.post(
        f"/api/task-jobs/lesson-pack-generate/{course_id}",
        headers=teacher_headers,
    )
    assert submit_response.status_code == 200
    submitted_job = submit_response.json()
    assert submitted_job["job_type"] == "lesson_pack.generate"
    assert submitted_job["status"] in {"queued", "running"}

    finished_job = _wait_for_job(client, teacher_headers, submitted_job["id"])
    assert finished_job["status"] == "succeeded"
    lesson_pack = finished_job["result"]["lesson_pack"]
    assert lesson_pack["course_id"] == course_id
    assert lesson_pack["id"]

    lesson_pack_detail_response = client.get(
        f"/api/lesson-packs/{lesson_pack['id']}",
        headers=teacher_headers,
    )
    assert lesson_pack_detail_response.status_code == 200
    assert lesson_pack_detail_response.json()["course_id"] == course_id


def test_async_material_update_preview_job_submission_and_polling(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")

    submit_response = client.post(
        "/api/task-jobs/material-update/preview",
        json={
            "course_id": "course-demo-001",
            "title": "异步更新建议测试",
            "instructions": "补充近两年的真实案例",
            "material_text": "原材料主要介绍 TCP/IP 基础概念。",
            "selected_model": "default",
        },
        headers=teacher_headers,
    )
    assert submit_response.status_code == 200
    submitted_job = submit_response.json()
    assert submitted_job["job_type"] == "material_update.preview"
    assert submitted_job["status"] in {"queued", "running"}

    finished_job = _wait_for_job(client, teacher_headers, submitted_job["id"])
    assert finished_job["status"] == "succeeded"
    material_update = finished_job["result"]["material_update"]
    assert material_update["title"] == "异步更新建议测试"
    assert material_update["summary"]

    history_response = client.get("/api/material-update", headers=teacher_headers)
    assert history_response.status_code == 200
    assert any(item["id"] == material_update["id"] for item in history_response.json())


def test_async_material_update_upload_job_submission_and_polling(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")

    submit_response = client.post(
        "/api/task-jobs/material-update/upload",
        data={
          "course_id": "course-demo-001",
          "title": "异步上传更新测试",
          "instructions": "补充一个与教材配套的案例页",
          "selected_model": "default",
        },
        files={"file": ("legacy-notes.txt", b"legacy material body", "text/plain")},
        headers=teacher_headers,
    )
    assert submit_response.status_code == 200
    submitted_job = submit_response.json()
    assert submitted_job["job_type"] == "material_update.upload"
    assert submitted_job["status"] in {"queued", "running"}

    finished_job = _wait_for_job(client, teacher_headers, submitted_job["id"])
    assert finished_job["status"] == "succeeded"
    material_update = finished_job["result"]["material_update"]
    assert material_update["title"] == "异步上传更新测试"
    assert material_update["summary"]


def test_task_job_list_returns_created_jobs_for_current_user(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")

    submit_response = client.post(
        "/api/task-jobs/material-update/preview",
        json={
            "course_id": "course-demo-001",
            "title": "任务列表测试",
            "instructions": "用于验证任务列表接口",
            "material_text": "list body",
            "selected_model": "default",
        },
        headers=teacher_headers,
    )
    assert submit_response.status_code == 200
    job_id = submit_response.json()["id"]

    list_response = client.get("/api/task-jobs?limit=10", headers=teacher_headers)
    assert list_response.status_code == 200
    assert any(item["id"] == job_id for item in list_response.json())


def test_recover_incomplete_jobs_marks_stale_rows_failed(client):
    from app.main import app
    from app.database import DBTaskJob

    task_jobs = app.state.task_jobs
    db = task_jobs._session_factory()
    try:
        now = datetime.now().isoformat()
        db.add(
            DBTaskJob(
                id="task-stale-001",
                job_type="material_update.preview",
                owner_user_id="user-teacher-demo",
                owner_role="teacher",
                course_id="course-demo-001",
                status="running",
                progress=55,
                message="执行中",
                input_json="{}",
                result_json="{}",
                error_message="",
                created_at=now,
                updated_at=now,
                started_at=now,
                finished_at="",
            ),
        )
        db.commit()
    finally:
        db.close()

    task_jobs.recover_incomplete_jobs()

    verify_db = task_jobs._session_factory()
    try:
        row = verify_db.query(DBTaskJob).filter(DBTaskJob.id == "task-stale-001").first()
        assert row is not None
        assert row.status == "failed"
        assert "服务重启" in row.error_message
    finally:
        verify_db.close()


def test_async_job_marks_failed_when_background_handler_raises(client):
    from app.services.task_job_handlers import MATERIAL_UPDATE_PREVIEW_JOB_TYPE
    from app.main import app

    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")
    task_jobs = app.state.task_jobs
    original_handler = task_jobs._handlers[MATERIAL_UPDATE_PREVIEW_JOB_TYPE]

    def _boom(_db, _job, _payload):
        raise RuntimeError("simulated async failure")

    task_jobs._handlers[MATERIAL_UPDATE_PREVIEW_JOB_TYPE] = _boom
    try:
        submit_response = client.post(
            "/api/task-jobs/material-update/preview",
            json={
                "course_id": "course-demo-001",
                "title": "异步失败测试",
                "instructions": "这里会触发模拟失败",
                "material_text": "failure body",
                "selected_model": "default",
            },
            headers=teacher_headers,
        )
        assert submit_response.status_code == 200
        submitted_job = submit_response.json()
        finished_job = _wait_for_job(client, teacher_headers, submitted_job["id"])
        assert finished_job["status"] == "failed"
        assert "simulated async failure" in finished_job["error_message"]
    finally:
        task_jobs._handlers[MATERIAL_UPDATE_PREVIEW_JOB_TYPE] = original_handler
