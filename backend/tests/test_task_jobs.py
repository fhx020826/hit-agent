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
    assert lesson_pack["version"] == 1
    assert lesson_pack["payload"]["segment_plan"]
    assert lesson_pack["payload"]["assessment_plan"]
    assert lesson_pack["payload"]["differentiation_support"]["foundation"]
    assert lesson_pack["payload"]["class_profile"]["audience"]

    second_submit_response = client.post(
        f"/api/task-jobs/lesson-pack-generate/{course_id}",
        headers=teacher_headers,
    )
    assert second_submit_response.status_code == 200
    second_finished_job = _wait_for_job(client, teacher_headers, second_submit_response.json()["id"])
    assert second_finished_job["status"] == "succeeded"
    assert second_finished_job["result"]["lesson_pack"]["version"] == 2

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
            "generation_mode": "generate_new",
            "target_format": "ppt",
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
    assert material_update["course_id"] == "course-demo-001"
    assert material_update["generation_mode"] == "generate_new"
    assert material_update["target_format"] == "ppt"
    assert material_update["generated_file_name"].endswith(".pptx")
    assert material_update["generated_download_url"]
    assert "teaching_flow" in material_update
    assert "speaker_notes" in material_update
    assert "assessment_checkpoints" in material_update

    download_response = client.get(material_update["generated_download_url"], headers=teacher_headers)
    assert download_response.status_code == 200
    assert download_response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
    assert download_response.content.startswith(b"PK")

    history_response = client.get("/api/material-update", headers=teacher_headers)
    assert history_response.status_code == 200
    assert any(item["id"] == material_update["id"] for item in history_response.json())


def test_async_material_update_upload_job_submission_and_polling(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")

    submit_response = client.post(
        "/api/task-jobs/material-update/upload",
        data={
          "course_id": "course-demo-001",
          "generation_mode": "update_existing",
          "target_format": "ppt",
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
    assert material_update["generation_mode"] == "update_existing"
    assert material_update["generated_download_url"] == ""
    assert "delivery_checklist" in material_update
    assert "reference_updates" in material_update


def test_material_update_history_record_can_be_deleted(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")

    submit_response = client.post(
        "/api/task-jobs/material-update/preview",
        json={
            "course_id": "course-demo-001",
            "generation_mode": "update_existing",
            "target_format": "ppt",
            "title": "可删除记录测试",
            "instructions": "根据旧讲义输出升级建议",
            "material_text": "这是旧教案正文。",
            "selected_model": "default",
        },
        headers=teacher_headers,
    )
    assert submit_response.status_code == 200

    finished_job = _wait_for_job(client, teacher_headers, submit_response.json()["id"])
    assert finished_job["status"] == "succeeded"
    material_update = finished_job["result"]["material_update"]

    delete_response = client.delete(f"/api/material-update/{material_update['id']}", headers=teacher_headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "deleted"

    history_response = client.get("/api/material-update", headers=teacher_headers)
    assert history_response.status_code == 200
    assert all(item["id"] != material_update["id"] for item in history_response.json())


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


def test_course_and_lesson_pack_management_endpoints(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")

    create_course_response = client.post(
        "/api/courses",
        json={
            "name": "课程管理测试",
            "audience": "计科2302班",
            "class_name": "计科2302班",
            "student_level": "本科",
            "chapter": "第六章",
            "objectives": "验证课程编辑与删除链路",
            "duration_minutes": 100,
            "frontier_direction": "智能编排",
        },
        headers=teacher_headers,
    )
    assert create_course_response.status_code == 200
    course = create_course_response.json()

    update_course_response = client.put(
        f"/api/courses/{course['id']}",
        json={
            "name": "课程管理测试-更新",
            "audience": "计科2302班",
            "class_name": "计科2302班",
            "student_level": "本科提高",
            "chapter": "第六章 更新",
            "objectives": "验证课程编辑链路",
            "duration_minutes": 110,
            "frontier_direction": "智能编排优化",
        },
        headers=teacher_headers,
    )
    assert update_course_response.status_code == 200
    assert update_course_response.json()["name"] == "课程管理测试-更新"

    submit_response = client.post(
        f"/api/task-jobs/lesson-pack-generate/{course['id']}",
        headers=teacher_headers,
    )
    assert submit_response.status_code == 200
    finished_job = _wait_for_job(client, teacher_headers, submit_response.json()["id"])
    assert finished_job["status"] == "succeeded"
    lesson_pack_id = finished_job["result"]["lesson_pack"]["id"]

    delete_pack_response = client.delete(f"/api/lesson-packs/{lesson_pack_id}", headers=teacher_headers)
    assert delete_pack_response.status_code == 200

    delete_course_response = client.delete(f"/api/courses/{course['id']}", headers=teacher_headers)
    assert delete_course_response.status_code == 200


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
