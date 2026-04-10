from __future__ import annotations


def test_health_check_returns_ok(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_student_can_register_login_and_read_profile(client):
    register_payload = {
        "role": "student",
        "account": "student_case_01",
        "password": "Student123!",
        "confirm_password": "Student123!",
        "profile": {
            "real_name": "测试学生",
            "gender": "男",
            "college": "计算机学院",
            "major": "软件工程",
            "grade": "2024级",
            "class_name": "软工2401班",
            "student_no": "20240001",
            "teacher_no": "",
            "department": "",
            "teaching_group": "",
            "role_title": "",
            "birth_date": "",
            "email": "student_case_01@example.com",
            "phone": "",
            "avatar_path": "",
            "bio": "",
            "research_direction": "",
            "interests": "",
            "common_courses": [],
            "linked_classes": [],
        },
    }

    register_response = client.post("/api/auth/register", json=register_payload)

    assert register_response.status_code == 200
    token = register_response.json()["token"]

    me_response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert me_response.status_code == 200
    assert me_response.json()["account"] == "student_case_01"
    assert me_response.json()["profile"]["class_name"] == "软工2401班"


def test_teacher_can_create_and_list_courses(client):
    login_response = client.post(
        "/api/auth/login",
        json={"role": "teacher", "account": "teacher_demo", "password": "Teacher123!"},
    )
    token = login_response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/api/courses",
        json={
            "name": "网络安全导论",
            "audience": "计科2402班",
            "class_name": "计科2402班",
            "student_level": "本科",
            "chapter": "第1章",
            "objectives": "理解基础安全概念",
            "duration_minutes": 100,
            "frontier_direction": "大模型安全",
        },
        headers=headers,
    )

    assert create_response.status_code == 200
    created_course = create_response.json()

    list_response = client.get("/api/courses", headers=headers)

    assert list_response.status_code == 200
    assert any(item["id"] == created_course["id"] for item in list_response.json())


def test_student_can_create_and_fetch_chat_session(client):
    login_response = client.post(
        "/api/auth/login",
        json={"role": "student", "account": "student_demo", "password": "Student123!"},
    )
    token = login_response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_session_response = client.post(
        "/api/qa/sessions",
        json={
            "course_id": "course-demo-001",
            "lesson_pack_id": "",
            "title": "测试问答会话",
            "selected_model": "default",
        },
        headers=headers,
    )

    assert create_session_response.status_code == 200
    session_id = create_session_response.json()["id"]

    list_response = client.get("/api/qa/sessions", headers=headers)
    detail_response = client.get(f"/api/qa/sessions/{session_id}", headers=headers)

    assert list_response.status_code == 200
    assert any(item["id"] == session_id for item in list_response.json())
    assert detail_response.status_code == 200
    assert detail_response.json()["title"] == "测试问答会话"
    assert detail_response.json()["questions"] == []
