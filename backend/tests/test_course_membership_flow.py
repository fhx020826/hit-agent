from __future__ import annotations


def _login(client, role: str, account: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"role": role, "account": account, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_student_can_join_course_and_see_management_view(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")
    student_headers = _login(client, "student", "student_demo", "Student123!")

    teacher_courses = client.get("/api/courses/teacher/manage", headers=teacher_headers)
    assert teacher_courses.status_code == 200
    assert teacher_courses.json()[0]["invite_code"] == "DEMO2301"

    student_courses = client.get("/api/courses", headers=student_headers)
    assert student_courses.status_code == 200
    assert any(item["id"] == "course-demo-001" for item in student_courses.json())

    join_response = client.post(
        "/api/courses/join",
        json={"invite_code": "DEMO2301", "class_name": "计科2301班"},
        headers=student_headers,
    )
    assert join_response.status_code == 200
    assert join_response.json()["id"] == "course-demo-001"

    feedback_pending = client.get("/api/feedback/pending", headers=student_headers)
    assert feedback_pending.status_code == 200
