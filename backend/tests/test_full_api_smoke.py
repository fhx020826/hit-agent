from __future__ import annotations


def _login(client, role: str, account: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"role": role, "account": account, "password": password},
    )
    assert response.status_code == 200
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_teacher_profile_settings_lesson_pack_and_agent_config_flow(client):
    headers = _login(client, "teacher", "teacher_demo", "Teacher123!")

    profile_response = client.get("/api/profile/me", headers=headers)
    assert profile_response.status_code == 200
    profile_payload = profile_response.json()
    profile_payload["bio"] = "负责课程设计与课堂测试"
    profile_payload["common_courses"] = ["计算机网络"]

    update_profile_response = client.put("/api/profile/me", json=profile_payload, headers=headers)
    assert update_profile_response.status_code == 200
    assert update_profile_response.json()["bio"] == "负责课程设计与课堂测试"

    settings_response = client.get("/api/settings/me", headers=headers)
    assert settings_response.status_code == 200

    update_settings_response = client.put(
        "/api/settings/me",
        json={
            "mode": "night",
            "accent": "green",
            "font": "serif",
            "skin": "clean",
            "language": "zh-CN",
        },
        headers=headers,
    )
    assert update_settings_response.status_code == 200
    assert update_settings_response.json()["mode"] == "night"

    compat_settings_response = client.get("/api/settings/teacher/user-teacher-demo")
    assert compat_settings_response.status_code == 200
    assert compat_settings_response.json()["user_id"] == "user-teacher-demo"

    agent_config_response = client.get("/api/agent-config/course-demo-001", headers=headers)
    assert agent_config_response.status_code == 200
    assert agent_config_response.json()["course_id"] == "course-demo-001"

    update_agent_config_response = client.put(
        "/api/agent-config/course-demo-001",
        json={
            "course_id": "course-demo-001",
            "scope_rules": "仅回答课程相关问题",
            "answer_style": "启发式",
            "enable_homework_support": True,
            "enable_material_qa": True,
            "enable_frontier_extension": False,
        },
        headers=headers,
    )
    assert update_agent_config_response.status_code == 200
    assert update_agent_config_response.json()["answer_style"] == "启发式"

    lesson_pack_list_response = client.get("/api/lesson-packs?course_id=course-demo-001", headers=headers)
    assert lesson_pack_list_response.status_code == 200
    assert any(item["id"] == "lp-demo-001" for item in lesson_pack_list_response.json())

    lesson_pack_detail_response = client.get("/api/lesson-packs/lp-demo-001", headers=headers)
    assert lesson_pack_detail_response.status_code == 200

    update_lesson_pack_response = client.put(
        "/api/lesson-packs/lp-demo-001",
        json={
            "payload": {
                "frontier_topic": {"title": "智能网络与可信路由"},
                "teaching_objectives": ["理解网络基础概念", "理解可信路由约束"],
                "main_thread": "网络基础与可信智能网络",
            },
            "status": "draft",
        },
        headers=headers,
    )
    assert update_lesson_pack_response.status_code == 200
    assert update_lesson_pack_response.json()["status"] == "draft"

    publish_lesson_pack_response = client.post("/api/lesson-packs/lp-demo-001/publish", headers=headers)
    assert publish_lesson_pack_response.status_code == 200
    assert publish_lesson_pack_response.json()["status"] == "published"

    analytics_response = client.get("/api/analytics/lp-demo-001")
    assert analytics_response.status_code == 200
    assert analytics_response.json()["lesson_pack_id"] == "lp-demo-001"


def test_admin_user_management_smoke(client):
    admin_headers = _login(client, "admin", "admin_demo", "Admin123!")
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")

    forbidden_response = client.get("/api/admin/users", headers=teacher_headers)
    assert forbidden_response.status_code == 403

    list_response = client.get("/api/admin/users", headers=admin_headers)
    assert list_response.status_code == 200
    assert any(item["account"] == "teacher_demo" for item in list_response.json())

    create_response = client.post(
        "/api/admin/users",
        json={
            "role": "student",
            "account": "student_admin_case",
            "password": "Student123!",
            "display_name": "管理员创建学生",
            "status": "active",
            "profile": {
                "real_name": "管理员创建学生",
                "gender": "女",
                "college": "计算机学院",
                "major": "人工智能",
                "grade": "2024级",
                "class_name": "计科2301班",
                "student_no": "20240099",
                "teacher_no": "",
                "department": "",
                "teaching_group": "",
                "role_title": "",
                "birth_date": "",
                "email": "student_admin_case@example.com",
                "phone": "",
                "avatar_path": "",
                "bio": "",
                "research_direction": "",
                "interests": "",
                "common_courses": [],
                "linked_classes": [],
            },
        },
        headers=admin_headers,
    )
    assert create_response.status_code == 200
    created_user = create_response.json()

    update_response = client.put(
        f"/api/admin/users/{created_user['id']}",
        json={
            "display_name": "管理员更新学生",
            "status": "inactive",
            "profile": {
                "real_name": "管理员更新学生",
                "gender": "女",
                "college": "计算机学院",
                "major": "智能科学",
                "grade": "2024级",
                "class_name": "计科2301班",
                "student_no": "20240099",
                "teacher_no": "",
                "department": "",
                "teaching_group": "",
                "role_title": "",
                "birth_date": "",
                "email": "student_admin_case@example.com",
                "phone": "",
                "avatar_path": "",
                "bio": "",
                "research_direction": "",
                "interests": "",
                "common_courses": [],
                "linked_classes": [],
            },
        },
        headers=admin_headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "inactive"

    delete_self_response = client.delete("/api/admin/users/user-admin-demo", headers=admin_headers)
    assert delete_self_response.status_code == 400

    delete_response = client.delete(f"/api/admin/users/{created_user['id']}", headers=admin_headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "ok"


def test_materials_and_discussion_flow_smoke(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")
    student_headers = _login(client, "student", "student_demo", "Student123!")

    upload_response = client.post(
        "/api/materials/upload/course-demo-001",
        files={"file": ("network-notes.txt", b"TCP/IP layered notes for classroom sharing.", "text/plain")},
        headers=teacher_headers,
    )
    assert upload_response.status_code == 200
    material_id = upload_response.json()["id"]

    teacher_materials_response = client.get("/api/materials/course-demo-001", headers=teacher_headers)
    assert teacher_materials_response.status_code == 200
    assert any(item["id"] == material_id for item in teacher_materials_response.json())

    share_response = client.post(
        "/api/materials/share",
        json={
            "course_id": "course-demo-001",
            "material_ids": [material_id],
            "title": "课堂共享讲义",
            "description": "供课堂讨论使用",
            "share_scope": "classroom",
            "share_type": "material",
        },
        headers=teacher_headers,
    )
    assert share_response.status_code == 200
    assert share_response.json()["materials"][0]["id"] == material_id

    current_shares_response = client.get("/api/materials/shares/current?course_id=course-demo-001", headers=student_headers)
    assert current_shares_response.status_code == 200
    assert any(item["title"] == "课堂共享讲义" for item in current_shares_response.json())

    student_materials_response = client.get("/api/materials/course-demo-001", headers=student_headers)
    assert student_materials_response.status_code == 200
    assert any(item["id"] == material_id for item in student_materials_response.json())

    request_response = client.post(
        "/api/materials/requests",
        json={"course_id": "course-demo-001", "request_text": "希望补充实验指导书"},
        headers=student_headers,
    )
    assert request_response.status_code == 200
    request_id = request_response.json()["id"]

    teacher_request_list_response = client.get("/api/materials/requests/teacher?course_id=course-demo-001", headers=teacher_headers)
    assert teacher_request_list_response.status_code == 200
    assert any(item["id"] == request_id for item in teacher_request_list_response.json())

    handle_request_response = client.post(
        f"/api/materials/requests/{request_id}/handle?status=approved",
        headers=teacher_headers,
    )
    assert handle_request_response.status_code == 200
    assert handle_request_response.json()["status"] == "approved"

    teacher_spaces_response = client.get("/api/discussions/spaces", headers=teacher_headers)
    assert teacher_spaces_response.status_code == 200
    assert teacher_spaces_response.json()
    space_id = teacher_spaces_response.json()[0]["id"]

    student_spaces_response = client.get("/api/discussions/spaces", headers=student_headers)
    assert student_spaces_response.status_code == 200
    assert any(item["id"] == space_id for item in student_spaces_response.json())

    space_detail_response = client.get(f"/api/discussions/spaces/{space_id}", headers=teacher_headers)
    assert space_detail_response.status_code == 200
    assert space_detail_response.json()["members"]

    send_message_response = client.post(
        "/api/discussions/messages",
        json={
            "space_id": space_id,
            "content": "本周讨论聚焦 TCP 拥塞控制。",
            "is_anonymous": False,
            "mention_ai": False,
            "attachment_ids": [],
        },
        headers=teacher_headers,
    )
    assert send_message_response.status_code == 200
    message_id = send_message_response.json()[0]["id"]

    list_messages_response = client.get(f"/api/discussions/spaces/{space_id}/messages", headers=student_headers)
    assert list_messages_response.status_code == 200
    assert any(item["id"] == message_id for item in list_messages_response.json()["items"])

    search_messages_response = client.get(
        f"/api/discussions/search?space_id={space_id}&keyword=拥塞控制",
        headers=student_headers,
    )
    assert search_messages_response.status_code == 200
    assert search_messages_response.json()["total"] >= 1

    context_response = client.get(f"/api/discussions/messages/{message_id}/context", headers=teacher_headers)
    assert context_response.status_code == 200
    assert context_response.json()["anchor_message_id"] == message_id


def test_assignments_feedback_and_survey_flow_smoke(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")
    student_headers = _login(client, "student", "student_demo", "Student123!")

    class_options_response = client.get("/api/assignments/teacher/class-options?course_id=course-demo-001", headers=teacher_headers)
    assert class_options_response.status_code == 200
    assert any(item["class_name"] == "计科2301班" for item in class_options_response.json())

    create_assignment_response = client.post(
        "/api/assignments",
        json={
            "course_id": "course-demo-001",
            "title": "网络分层作业",
            "description": "说明 TCP/IP 分层设计。",
            "target_class": "计科2301班",
            "deadline": "2026-04-20T23:59:00",
            "attachment_requirements": "提交 txt 或 pdf",
            "submission_format": "文档",
            "grading_notes": "关注结构与逻辑",
            "allow_resubmit": True,
            "enable_ai_feedback": True,
            "remind_days": 2,
        },
        headers=teacher_headers,
    )
    assert create_assignment_response.status_code == 200
    assignment_id = create_assignment_response.json()["id"]

    teacher_assignments_response = client.get("/api/assignments/teacher", headers=teacher_headers)
    assert teacher_assignments_response.status_code == 200
    assert any(item["id"] == assignment_id for item in teacher_assignments_response.json())

    student_assignments_response = client.get("/api/assignments/student", headers=student_headers)
    assert student_assignments_response.status_code == 200
    assert any(item["assignment"]["id"] == assignment_id for item in student_assignments_response.json())

    confirm_response = client.post(f"/api/assignments/{assignment_id}/confirm", headers=student_headers)
    assert confirm_response.status_code == 200
    assert confirm_response.json()["confirmed"] is True

    submit_response = client.post(
        f"/api/assignments/{assignment_id}/submit",
        files=[("files", ("homework.txt", b"TCP/IP includes application, transport, network and link layers.", "text/plain"))],
        headers=student_headers,
    )
    assert submit_response.status_code == 200
    submission_id = submit_response.json()["id"]
    file_token = submit_response.json()["files"][0]["download_url"].rsplit("/", 1)[-1]

    refreshed_student_assignments_response = client.get("/api/assignments/student", headers=student_headers)
    assert refreshed_student_assignments_response.status_code == 200
    refreshed_assignment = next(item for item in refreshed_student_assignments_response.json() if item["assignment"]["id"] == assignment_id)
    assert refreshed_assignment["submission"]["id"] == submission_id
    assert refreshed_assignment["feedback"] is not None

    teacher_detail_response = client.get(f"/api/assignments/teacher/{assignment_id}", headers=teacher_headers)
    assert teacher_detail_response.status_code == 200
    assert any(item["user_id"] == "user-student-demo" for item in teacher_detail_response.json()["submitted_students"])

    download_submission_response = client.get(
        f"/api/assignments/submissions/{submission_id}/files/{file_token}",
        headers=teacher_headers,
    )
    assert download_submission_response.status_code == 200

    templates_response = client.get("/api/feedback/templates", headers=teacher_headers)
    assert templates_response.status_code == 200
    assert any(item["id"] == "survey-template-default" for item in templates_response.json())

    create_survey_response = client.post(
        "/api/feedback/instances",
        json={
            "lesson_pack_id": "lp-demo-001",
            "course_id": "course-demo-001",
            "template_id": "survey-template-default",
            "title": "课后反馈",
            "trigger_mode": "manual",
        },
        headers=teacher_headers,
    )
    assert create_survey_response.status_code == 200
    survey_instance_id = create_survey_response.json()["id"]

    pending_surveys_response = client.get("/api/feedback/pending", headers=student_headers)
    assert pending_surveys_response.status_code == 200
    assert any(item["id"] == survey_instance_id for item in pending_surveys_response.json())

    submit_survey_response = client.post(
        f"/api/feedback/instances/{survey_instance_id}/submit",
        json={
            "answers": {
                "q_rating": 5,
                "q_choice": "拥塞控制",
                "q_text": "希望增加案例分析。",
            }
        },
        headers=student_headers,
    )
    assert submit_survey_response.status_code == 200
    assert submit_survey_response.json()["status"] == "ok"

    survey_analytics_response = client.get(f"/api/feedback/analytics/{survey_instance_id}", headers=teacher_headers)
    assert survey_analytics_response.status_code == 200
    assert survey_analytics_response.json()["participation_count"] == 1


def test_legacy_routes_and_preview_endpoints_smoke(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")

    profile_students_response = client.get("/api/profile/students", headers=teacher_headers)
    assert profile_students_response.status_code == 200
    assert any(item["id"] == "user-student-demo" for item in profile_students_response.json())

    profile_teachers_response = client.get("/api/profile/teachers", headers=teacher_headers)
    assert profile_teachers_response.status_code == 200
    assert any(item["id"] == "user-teacher-demo" for item in profile_teachers_response.json())

    create_legacy_teacher_response = client.post(
        "/api/users/teachers",
        json={"name": "王老师", "department": "计算机学院", "title": "副教授", "gender": "男"},
    )
    assert create_legacy_teacher_response.status_code == 200

    create_legacy_student_response = client.post(
        "/api/users/students",
        json={"name": "张三", "grade": "2023级", "major": "计算机科学与技术", "gender": "男"},
    )
    assert create_legacy_student_response.status_code == 200
    legacy_student_id = create_legacy_student_response.json()["id"]

    legacy_teachers_response = client.get("/api/users/teachers")
    assert legacy_teachers_response.status_code == 200
    assert any(item["name"] == "王老师" for item in legacy_teachers_response.json())

    legacy_students_response = client.get("/api/users/students")
    assert legacy_students_response.status_code == 200
    assert any(item["id"] == legacy_student_id for item in legacy_students_response.json())

    lesson_packs_response = client.get("/api/student/lesson-packs")
    assert lesson_packs_response.status_code == 200
    assert any(item["id"] == "lp-demo-001" for item in lesson_packs_response.json())

    lesson_pack_response = client.get("/api/student/lesson-packs/lp-demo-001")
    assert lesson_pack_response.status_code == 200
    assert lesson_pack_response.json()["id"] == "lp-demo-001"

    student_qa_response = client.post(
        "/api/student/lesson-packs/lp-demo-001/qa",
        json={
            "question": "请概括本节课的核心内容。",
            "student_id": legacy_student_id,
            "anonymous": False,
        },
    )
    assert student_qa_response.status_code == 200
    assert "answer" in student_qa_response.json()

    assignment_review_response = client.post(
        "/api/assignment-review/preview",
        json={
            "course_id": "course-demo-001",
            "assignment_type": "作业",
            "title": "网络分层作业",
            "requirements": "说明 TCP/IP 分层设计。",
            "submission_text": "提交内容：从应用层到链路层依次说明。",
        },
    )
    assert assignment_review_response.status_code == 200
    assert assignment_review_response.json()["summary"]

    material_update_preview_response = client.post(
        "/api/material-update/preview",
        json={
            "course_id": "course-demo-001",
            "title": "课件更新建议",
            "instructions": "补充最新趋势案例",
            "material_text": "当前课件主要介绍 TCP/IP 基础概念。",
            "selected_model": "default",
        },
        headers=teacher_headers,
    )
    assert material_update_preview_response.status_code == 200
    assert material_update_preview_response.json()["title"] == "课件更新建议"
