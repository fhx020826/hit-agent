from __future__ import annotations


def _login(client, role: str, account: str, password: str) -> dict[str, str]:
    resp = client.post("/api/auth/login", json={"role": role, "account": account, "password": password})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['token']}"}


def test_admin_seed_demo_school_is_idempotent(client):
    admin = _login(client, "admin", "admin_demo", "Admin123!")

    first = client.post("/api/admin/academic/seed-demo-school", headers=admin)
    second = client.post("/api/admin/academic/seed-demo-school", headers=admin)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["summary"]["already_seeded"] is True

    teachers = client.get("/api/admin/academic/teachers", headers=admin).json()
    students = client.get("/api/admin/academic/students", headers=admin).json()
    courses = client.get("/api/admin/academic/courses", headers=admin).json()
    offerings = client.get("/api/admin/academic/offerings", headers=admin).json()
    enrollments = client.get("/api/admin/academic/enrollments", headers=admin).json()

    assert len(teachers) >= 6
    assert len(students) >= 60
    assert len(courses) >= 8
    assert len(offerings) >= 8
    assert len(enrollments) > 0
    assert all(offering["teacher_user_id"] for offering in offerings)
    assert all(offering["enrolled_count"] >= 1 for offering in offerings)


def test_teacher_and_student_only_see_seeded_relationships(client):
    admin = _login(client, "admin", "admin_demo", "Admin123!")
    client.post("/api/admin/academic/seed-demo-school", headers=admin)

    teacher = _login(client, "teacher", "teacher_demo", "Teacher123!")
    student = _login(client, "student", "student_demo", "Student123!")

    teacher_offerings = client.get("/api/teacher/course-management/offerings", headers=teacher)
    student_courses = client.get("/api/student/courses", headers=student)

    assert teacher_offerings.status_code == 200
    assert student_courses.status_code == 200
    assert len(teacher_offerings.json()) >= 1
    assert len(student_courses.json()) >= 1
    assert all(item["teacher_user_id"] == "user-teacher-demo" for item in teacher_offerings.json())
    assert all(item["enrolled_count"] >= 1 for item in student_courses.json())


def test_manual_join_and_teacher_self_binding_are_disabled(client):
    admin = _login(client, "admin", "admin_demo", "Admin123!")
    client.post("/api/admin/academic/seed-demo-school", headers=admin)

    teacher = _login(client, "teacher", "teacher_demo", "Teacher123!")
    student = _login(client, "student", "student_demo", "Student123!")

    join_resp = client.post("/api/student/courses/join", json={"code": "DEBUG-001"}, headers=student)
    create_course_resp = client.post("/api/teacher/course-management/courses", json={"name": "Should Fail"}, headers=teacher)
    create_offering_resp = client.post(
        "/api/teacher/course-management/offerings",
        json={"academic_course_id": "demo-academic-001", "class_id": "demo-class-001", "semester": "2025-2026-2"},
        headers=teacher,
    )

    assert join_resp.status_code == 403
    assert create_course_resp.status_code == 403
    assert create_offering_resp.status_code == 403


def test_admin_can_export_demo_accounts(client):
    admin = _login(client, "admin", "admin_demo", "Admin123!")
    client.post("/api/admin/academic/seed-demo-school", headers=admin)

    export_resp = client.get("/api/admin/academic/export-accounts", headers=admin)

    assert export_resp.status_code == 200
    payload = export_resp.json()
    assert len(payload["teachers"]) >= 1
    assert len(payload["students"]) >= 1
    assert payload["teachers"][0]["initial_password"]
