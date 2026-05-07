from __future__ import annotations


def _login(client, role: str, account: str, password: str) -> dict[str, str]:
    resp = client.post("/api/auth/login", json={"role": role, "account": account, "password": password})
    assert resp.status_code == 200
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_admin_seed_and_offering_flow(client):
    admin = _login(client, "admin", "admin_demo", "Admin123!")

    seed1 = client.post("/api/admin/academic/seed-demo-school", headers=admin)
    assert seed1.status_code == 200
    seed2 = client.post("/api/admin/academic/seed-demo-school", headers=admin)
    assert seed2.status_code == 200

    classes = client.get("/api/admin/academic/classes", headers=admin)
    assert classes.status_code == 200
    assert len(classes.json()) >= 1

    courses = client.get("/api/admin/academic/courses", headers=admin)
    assert courses.status_code == 200
    assert len(courses.json()) >= 1

    teachers = client.get("/api/admin/academic/teachers", headers=admin)
    assert teachers.status_code == 200
    assert len(teachers.json()) >= 1

    class_id = classes.json()[0]["id"]
    course_id = courses.json()[0]["id"]
    teacher_id = teachers.json()[0]["id"]

    create_off = client.post(
        "/api/admin/academic/offerings",
        json={
            "academic_course_id": course_id,
            "teacher_user_id": teacher_id,
            "class_id": class_id,
            "semester": "2025-2026-2",
            "join_enabled": True,
        },
        headers=admin,
    )
    assert create_off.status_code == 200
    offering = create_off.json()
    assert offering["invite_code"]

    sync = client.post(f"/api/admin/academic/offerings/{offering['id']}/sync-class-students", headers=admin)
    assert sync.status_code == 200


def test_teacher_student_course_relationship_access(client):
    admin = _login(client, "admin", "admin_demo", "Admin123!")
    _ = client.post("/api/admin/academic/seed-demo-school", headers=admin)

    teacher = _login(client, "teacher", "teacher_demo", "Teacher123!")
    student = _login(client, "student", "student_demo", "Student123!")

    teacher_offerings = client.get("/api/teacher/course-management/offerings", headers=teacher)
    assert teacher_offerings.status_code == 200
    assert len(teacher_offerings.json()) >= 1

    my_courses = client.get("/api/student/courses", headers=student)
    assert my_courses.status_code == 200
    assert len(my_courses.json()) >= 1

    invite_code = teacher_offerings.json()[0]["invite_code"]
    joined = client.post("/api/student/courses/join", json={"code": invite_code}, headers=student)
    assert joined.status_code == 200

    bad_join = client.post("/api/student/courses/join", json={"code": "INVALID"}, headers=student)
    assert bad_join.status_code == 400
