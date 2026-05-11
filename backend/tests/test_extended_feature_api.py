from __future__ import annotations


def _login(client, role: str, account: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"role": role, "account": account, "password": password},
    )
    assert response.status_code == 200
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_profile_avatar_and_compatibility_endpoints(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")
    admin_headers = _login(client, "admin", "admin_demo", "Admin123!")

    course_detail_response = client.get("/api/courses/course-demo-001", headers=teacher_headers)
    assert course_detail_response.status_code == 200
    assert course_detail_response.json()["id"] == "course-demo-001"

    avatar_upload_response = client.post(
        "/api/profile/avatar",
        files={"file": ("avatar.png", b"\x89PNG\r\n\x1a\navatar", "image/png")},
        headers=teacher_headers,
    )
    assert avatar_upload_response.status_code == 200
    avatar_path = avatar_upload_response.json()["avatar_path"]

    avatar_fetch_response = client.get(avatar_path)
    assert avatar_fetch_response.status_code == 200

    compat_get_response = client.get("/api/settings/teacher/user-teacher-demo")
    assert compat_get_response.status_code == 200
    assert compat_get_response.json()["user_id"] == "user-teacher-demo"

    compat_put_response = client.put(
        "/api/settings/teacher/user-teacher-demo",
        json={
            "mode": "eye-care",
            "accent": "purple",
            "font": "mono",
            "skin": "tech",
            "language": "en-US",
        },
    )
    assert compat_put_response.status_code == 200
    assert compat_put_response.json()["language"] == "en-US"

    teacher_directory_response = client.get("/api/profile/teachers", headers=teacher_headers)
    assert teacher_directory_response.status_code == 200
    assert any(item["id"] == "user-teacher-demo" for item in teacher_directory_response.json())

    student_directory_response = client.get("/api/profile/students", headers=teacher_headers)
    assert student_directory_response.status_code == 200
    assert any(item["id"] == "user-student-demo" for item in student_directory_response.json())

    feedback_templates_response = client.get("/api/feedback/templates", headers=teacher_headers)
    assert feedback_templates_response.status_code == 200
    assert any(item["id"] == "survey-template-default" for item in feedback_templates_response.json())

    create_teacher_response = client.post(
        "/api/users/teachers",
        json={"name": "兼容教师", "department": "网络空间安全", "title": "副教授", "gender": "女"},
    )
    assert create_teacher_response.status_code == 200

    create_student_response = client.post(
        "/api/users/students",
        json={"name": "兼容学生", "grade": "2024级", "major": "人工智能", "gender": "男"},
    )
    assert create_student_response.status_code == 200

    compat_teachers_response = client.get("/api/users/teachers")
    assert compat_teachers_response.status_code == 200
    assert any(item["name"] == "兼容教师" for item in compat_teachers_response.json())

    compat_students_response = client.get("/api/users/students")
    assert compat_students_response.status_code == 200
    assert any(item["name"] == "兼容学生" for item in compat_students_response.json())

    create_admin_user_response = client.post(
        "/api/admin/users",
        json={
            "role": "student",
            "account": "extended_admin_case",
            "password": "Student123!",
            "display_name": "扩展管理员学生",
            "status": "active",
            "profile": {
                "real_name": "扩展管理员学生",
                "gender": "男",
                "college": "计算机学院",
                "major": "软件工程",
                "grade": "2024级",
                "class_name": "计科2301班",
                "student_no": "20249991",
                "teacher_no": "",
                "department": "",
                "teaching_group": "",
                "role_title": "",
                "birth_date": "",
                "email": "extended_admin_case@example.com",
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
    assert create_admin_user_response.status_code == 200
    created_user = create_admin_user_response.json()

    update_admin_user_response = client.put(
        f"/api/admin/users/{created_user['id']}",
        json={
            "display_name": "扩展管理员学生已更新",
            "status": "inactive",
            "profile": {
                "real_name": "扩展管理员学生已更新",
                "gender": "男",
                "college": "计算机学院",
                "major": "数据科学",
                "grade": "2024级",
                "class_name": "计科2301班",
                "student_no": "20249991",
                "teacher_no": "",
                "department": "",
                "teaching_group": "",
                "role_title": "",
                "birth_date": "",
                "email": "extended_admin_case@example.com",
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
    assert update_admin_user_response.status_code == 200
    assert update_admin_user_response.json()["display_name"] == "扩展管理员学生已更新"


def test_qa_attachment_folder_notification_and_legacy_student_flow(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")
    student_headers = _login(client, "student", "student_demo", "Student123!")

    legacy_list_response = client.get("/api/student/lesson-packs")
    assert legacy_list_response.status_code == 200
    assert any(item["id"] == "lp-demo-001" for item in legacy_list_response.json())

    legacy_detail_response = client.get("/api/student/lesson-packs/lp-demo-001")
    assert legacy_detail_response.status_code == 200
    assert legacy_detail_response.json()["id"] == "lp-demo-001"

    legacy_qa_response = client.post(
        "/api/student/lesson-packs/lp-demo-001/qa",
        json={"question": "QUIC 为什么基于 UDP？", "student_id": None, "anonymous": True},
    )
    assert legacy_qa_response.status_code == 200
    assert legacy_qa_response.json()["answer"]

    attachment_upload_response = client.post(
        "/api/qa/attachments",
        files={"files": ("question.txt", b"question attachment body", "text/plain")},
        headers=student_headers,
    )
    assert attachment_upload_response.status_code == 200
    attachment_id = attachment_upload_response.json()[0]["id"]
    attachment_download_url = attachment_upload_response.json()[0]["download_url"]

    create_session_response = client.post(
        "/api/qa/sessions",
        json={
            "course_id": "course-demo-001",
            "lesson_pack_id": "lp-demo-001",
            "title": "扩展问答会话",
            "selected_model": "default",
        },
        headers=student_headers,
    )
    assert create_session_response.status_code == 200
    session_id = create_session_response.json()["id"]

    create_folder_response = client.post(
        "/api/qa/folders",
        json={"course_id": "course-demo-001", "name": "扩展文件夹", "description": "用于扩展覆盖"},
        headers=student_headers,
    )
    assert create_folder_response.status_code == 200
    folder_id = create_folder_response.json()["id"]

    update_folder_response = client.put(
        f"/api/qa/folders/{folder_id}",
        json={"name": "扩展文件夹-已更新", "description": "更新后的说明"},
        headers=student_headers,
    )
    assert update_folder_response.status_code == 200
    assert update_folder_response.json()["name"] == "扩展文件夹-已更新"

    ask_question_response = client.post(
        "/api/qa/ask",
        json={
            "session_id": session_id,
            "course_id": "course-demo-001",
            "lesson_pack_id": "lp-demo-001",
            "question": "请教师结合附件解释 TCP 与 UDP 的差异",
            "answer_target_type": "both",
            "anonymous": False,
            "selected_model": "default",
            "attachment_ids": [attachment_id],
        },
        headers=student_headers,
    )
    assert ask_question_response.status_code == 200
    question_id = ask_question_response.json()["id"]

    session_detail_response = client.get(f"/api/qa/sessions/{session_id}", headers=student_headers)
    assert session_detail_response.status_code == 200
    assert any(item["id"] == question_id for item in session_detail_response.json()["questions"])

    collect_response = client.post(f"/api/qa/questions/{question_id}/collect", headers=student_headers)
    assert collect_response.status_code == 200
    assert collect_response.json()["collected"] is True

    assign_folder_response = client.put(
        f"/api/qa/questions/{question_id}/folder",
        json={"folder_id": folder_id},
        headers=student_headers,
    )
    assert assign_folder_response.status_code == 200
    assert assign_folder_response.json()["folder_id"] == folder_id

    teacher_questions_response = client.get("/api/qa/teacher/questions?status=pending", headers=teacher_headers)
    assert teacher_questions_response.status_code == 200
    assert any(item["id"] == question_id for item in teacher_questions_response.json())

    teacher_notifications_response = client.get("/api/qa/teacher/notifications", headers=teacher_headers)
    assert teacher_notifications_response.status_code == 200
    notification = next(item for item in teacher_notifications_response.json() if item["related_question_id"] == question_id)

    mark_read_response = client.post(
        f"/api/qa/teacher/notifications/{notification['id']}/read?is_read=true",
        headers=teacher_headers,
    )
    assert mark_read_response.status_code == 200
    assert mark_read_response.json()["is_read"] is True

    mark_unread_response = client.post(
        f"/api/qa/teacher/notifications/{notification['id']}/read?is_read=false",
        headers=teacher_headers,
    )
    assert mark_unread_response.status_code == 200
    assert mark_unread_response.json()["is_read"] is False

    teacher_attachment_download_response = client.get(attachment_download_url, headers=teacher_headers)
    assert teacher_attachment_download_response.status_code == 200

    replied_response = client.post(
        f"/api/qa/teacher/questions/{question_id}/reply",
        json={"reply_content": "这是教师回复。", "status": "replied"},
        headers=teacher_headers,
    )
    assert replied_response.status_code == 200
    assert replied_response.json()["teacher_reply_status"] == "replied"

    pending_again_response = client.post(
        f"/api/qa/teacher/questions/{question_id}/reply",
        json={"reply_content": "", "status": "pending"},
        headers=teacher_headers,
    )
    assert pending_again_response.status_code == 200
    assert pending_again_response.json()["teacher_reply_status"] == "pending"

    closed_response = client.post(
        f"/api/qa/teacher/questions/{question_id}/reply",
        json={"reply_content": "最终处理结论。", "status": "closed"},
        headers=teacher_headers,
    )
    assert closed_response.status_code == 200
    assert closed_response.json()["teacher_reply_status"] == "closed"

    delete_question_response = client.delete(f"/api/qa/questions/{question_id}", headers=student_headers)
    assert delete_question_response.status_code == 200

    delete_folder_response = client.delete(f"/api/qa/folders/{folder_id}", headers=student_headers)
    assert delete_folder_response.status_code == 200


def test_learning_record_nested_folder_notebook_and_sorting_flow(client):
    student_headers = _login(client, "student", "student_demo", "Student123!")

    create_session_response = client.post(
        "/api/qa/sessions",
        json={
            "course_id": "course-demo-001",
            "lesson_pack_id": "lp-demo-001",
            "title": "多级目录测试",
            "selected_model": "default",
        },
        headers=student_headers,
    )
    assert create_session_response.status_code == 200
    session_id = create_session_response.json()["id"]

    root_folder_response = client.post(
        "/api/qa/folders",
        json={"course_id": "course-demo-001", "name": "计算机网络", "description": "课程总目录"},
        headers=student_headers,
    )
    assert root_folder_response.status_code == 200
    root_folder_id = root_folder_response.json()["id"]
    assert root_folder_response.json()["parent_folder_id"] == ""

    child_folder_response = client.post(
        "/api/qa/folders",
        json={"course_id": "course-demo-001", "name": "第2章", "parent_folder_id": root_folder_id},
        headers=student_headers,
    )
    assert child_folder_response.status_code == 200
    child_folder_id = child_folder_response.json()["id"]
    assert child_folder_response.json()["parent_folder_id"] == root_folder_id

    notebook_response = client.post(
        "/api/qa/notebooks",
        json={
            "course_id": "course-demo-001",
            "parent_folder_id": child_folder_id,
            "title": "HTTP/3 复习提纲",
            "content_text": "第一部分：连接建立\n第二部分：流复用",
        },
        headers=student_headers,
    )
    assert notebook_response.status_code == 200
    notebook_id = notebook_response.json()["id"]
    assert notebook_response.json()["parent_folder_id"] == child_folder_id

    notebook_image_response = client.post(
        f"/api/qa/notebooks/{notebook_id}/images",
        files={"files": ("note.png", b"\x89PNG\r\n\x1a\nnotebook", "image/png")},
        headers=student_headers,
    )
    assert notebook_image_response.status_code == 200
    assert len(notebook_image_response.json()) == 1
    image_id = notebook_image_response.json()[0]["id"]

    notebook_detail_response = client.get(f"/api/qa/notebooks/{notebook_id}", headers=student_headers)
    assert notebook_detail_response.status_code == 200
    assert notebook_detail_response.json()["image_count"] == 1

    ask_question_response = client.post(
        "/api/qa/ask",
        json={
            "session_id": session_id,
            "course_id": "course-demo-001",
            "lesson_pack_id": "lp-demo-001",
            "question": "请总结 HTTP/3 在学习资料中的核心变化",
            "answer_target_type": "ai",
            "anonymous": False,
            "selected_model": "default",
            "attachment_ids": [],
        },
        headers=student_headers,
    )
    assert ask_question_response.status_code == 200
    question_id = ask_question_response.json()["id"]

    move_question_response = client.put(
        f"/api/qa/questions/{question_id}/folder",
        json={"folder_id": child_folder_id},
        headers=student_headers,
    )
    assert move_question_response.status_code == 200
    assert move_question_response.json()["folder_id"] == child_folder_id

    root_contents_response = client.get("/api/qa/folders/root/contents?course_id=course-demo-001", headers=student_headers)
    assert root_contents_response.status_code == 200
    assert any(item["id"] == root_folder_id and item["item_type"] == "folder" for item in root_contents_response.json()["items"])

    child_contents_response = client.get(f"/api/qa/folders/{child_folder_id}/contents?sort_by=updated_at&sort_order=desc", headers=student_headers)
    assert child_contents_response.status_code == 200
    child_payload = child_contents_response.json()
    assert [item["name"] for item in child_payload["breadcrumbs"]] == ["计算机网络", "第2章"]
    assert any(item["id"] == notebook_id and item["item_type"] == "notebook" for item in child_payload["items"])
    assert any(item["id"] == question_id and item["item_type"] == "question" for item in child_payload["items"])

    delete_without_cascade_response = client.delete(f"/api/qa/folders/{root_folder_id}", headers=student_headers)
    assert delete_without_cascade_response.status_code == 400

    delete_image_response = client.delete(f"/api/qa/notebook-images/{image_id}", headers=student_headers)
    assert delete_image_response.status_code == 200

    cascade_delete_response = client.delete(f"/api/qa/folders/{root_folder_id}?cascade=true", headers=student_headers)
    assert cascade_delete_response.status_code == 200

    folder_after_delete_response = client.get(f"/api/qa/folders/{child_folder_id}/contents", headers=student_headers)
    assert folder_after_delete_response.status_code == 404


def test_discussion_attachment_and_live_share_end_to_end(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")
    student_headers = _login(client, "student", "student_demo", "Student123!")

    material_upload_response = client.post(
        "/api/materials/upload/course-demo-001",
        files={"file": ("live-material.pdf", b"%PDF-1.4 demo pdf", "application/pdf")},
        headers=teacher_headers,
    )
    assert material_upload_response.status_code == 200
    material_id = material_upload_response.json()["id"]
    material_download_url = material_upload_response.json()["download_url"]
    assert "page_aspect_ratio" in material_upload_response.json()
    assert material_upload_response.json()["page_aspect_ratio"] is None

    material_download_response = client.get(material_download_url, headers=teacher_headers)
    assert material_download_response.status_code == 200

    spaces_response = client.get("/api/discussions/spaces", headers=student_headers)
    assert spaces_response.status_code == 200
    space_id = spaces_response.json()[0]["id"]

    discussion_attachment_response = client.post(
        f"/api/discussions/attachments?space_id={space_id}",
        files={"files": ("discussion.txt", b"discussion attachment body", "text/plain")},
        headers=student_headers,
    )
    assert discussion_attachment_response.status_code == 200
    discussion_attachment_id = discussion_attachment_response.json()[0]["id"]
    discussion_attachment_download_url = discussion_attachment_response.json()[0]["download_url"]

    send_message_response = client.post(
        "/api/discussions/messages",
        json={
            "space_id": space_id,
            "content": "@AI 请结合附件总结课堂重点",
            "is_anonymous": True,
            "mention_ai": True,
            "attachment_ids": [discussion_attachment_id],
        },
        headers=student_headers,
    )
    assert send_message_response.status_code == 200
    created_messages = send_message_response.json()
    user_message = created_messages[0]
    ai_message = created_messages[1]

    named_message_response = client.post(
        "/api/discussions/messages",
        json={
            "space_id": space_id,
            "content": "这是一条实名讨论消息",
            "is_anonymous": False,
            "mention_ai": False,
            "attachment_ids": [],
        },
        headers=student_headers,
    )
    assert named_message_response.status_code == 200

    list_messages_response = client.get(f"/api/discussions/spaces/{space_id}/messages", headers=teacher_headers)
    assert list_messages_response.status_code == 200
    assert any(item["id"] == user_message["id"] for item in list_messages_response.json()["items"])

    search_sender_response = client.get(
        f"/api/discussions/search?space_id={space_id}&sender_type=student",
        headers=teacher_headers,
    )
    assert search_sender_response.status_code == 200
    assert search_sender_response.json()["total"] >= 1

    member_messages_response = client.get(
        f"/api/discussions/spaces/{space_id}/members/user-student-demo/messages",
        headers=teacher_headers,
    )
    assert member_messages_response.status_code == 200
    assert member_messages_response.json()["total"] >= 1

    context_response = client.get(
        f"/api/discussions/messages/{ai_message['id']}/context",
        headers=teacher_headers,
    )
    assert context_response.status_code == 200
    assert context_response.json()["anchor_message_id"] == ai_message["id"]

    attachment_download_response = client.get(discussion_attachment_download_url, headers=teacher_headers)
    assert attachment_download_response.status_code == 200

    start_live_response = client.post(
        "/api/materials/live/start",
        json={"material_id": material_id, "share_target_type": "course_class", "share_target_id": "计科2301班"},
        headers=teacher_headers,
    )
    assert start_live_response.status_code == 200
    share_id = start_live_response.json()["id"]

    current_live_response = client.get("/api/materials/live/current?course_id=course-demo-001", headers=student_headers)
    assert current_live_response.status_code == 200
    assert current_live_response.json()["id"] == share_id

    update_page_response = client.post(
        f"/api/materials/live/{share_id}/page",
        json={"current_page": 3},
        headers=teacher_headers,
    )
    assert update_page_response.status_code == 200
    assert update_page_response.json()["current_page"] == 3

    create_annotation_response = client.post(
        f"/api/materials/live/{share_id}/annotations",
        json={
            "page_no": 3,
            "tool_type": "highlighter",
            "color": "#22c55e",
            "line_width": 8,
            "points_data": [{"x": 10, "y": 12}, {"x": 180, "y": 90}],
            "is_temporary": False,
        },
        headers=teacher_headers,
    )
    assert create_annotation_response.status_code == 200
    annotation_id = create_annotation_response.json()["id"]

    list_annotations_response = client.get(
        f"/api/materials/live/{share_id}/annotations?page_no=3",
        headers=student_headers,
    )
    assert list_annotations_response.status_code == 200
    assert any(item["id"] == annotation_id for item in list_annotations_response.json())

    end_live_response = client.post(
        f"/api/materials/live/{share_id}/end",
        json={"save_mode": "save", "version_name": "扩展课堂批注版本"},
        headers=teacher_headers,
    )
    assert end_live_response.status_code == 200
    assert end_live_response.json()["is_active"] is False

    versions_response = client.get(f"/api/materials/live/{share_id}/versions", headers=teacher_headers)
    assert versions_response.status_code == 200
    assert any(item["version_name"] == "扩展课堂批注版本" for item in versions_response.json())


def test_feedback_skip_and_pending_visibility(client):
    teacher_headers = _login(client, "teacher", "teacher_demo", "Teacher123!")
    student_headers = _login(client, "student", "student_demo", "Student123!")

    create_survey_response = client.post(
        "/api/feedback/instances",
        json={
            "lesson_pack_id": "lp-demo-001",
            "course_id": "course-demo-001",
            "template_id": "survey-template-default",
            "title": "用于跳过的匿名反馈",
            "trigger_mode": "manual",
        },
        headers=teacher_headers,
    )
    assert create_survey_response.status_code == 200
    survey_id = create_survey_response.json()["id"]

    pending_before_skip_response = client.get("/api/feedback/pending", headers=student_headers)
    assert pending_before_skip_response.status_code == 200
    assert any(item["id"] == survey_id for item in pending_before_skip_response.json())

    skip_response = client.post(f"/api/feedback/instances/{survey_id}/skip", headers=student_headers)
    assert skip_response.status_code == 200

    pending_after_skip_response = client.get("/api/feedback/pending", headers=student_headers)
    assert pending_after_skip_response.status_code == 200
    assert all(item["id"] != survey_id for item in pending_after_skip_response.json())
