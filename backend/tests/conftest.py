from __future__ import annotations

import json
import sys
from collections.abc import Generator
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app import database, main
from app.database import (  # noqa: E402
    Base,
    DBAcademicCourse,
    DBCourse,
    DBCourseEnrollment,
    DBCourseOffering,
    DBDiscussionSpace,
    DBDiscussionSpaceMember,
    DBLessonPack,
    DBMaterialUpdateJob,
    DBSchoolClass,
    DBSurveyTemplate,
    DBTaskJob,
    DBUser,
    DBUserProfile,
)
from app.db.bootstrap import seed_demo_school_data  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.services import discussion_service, llm_service, qa_service, task_job_handlers  # noqa: E402
from app.services.mock_data import mock_generate_lesson_pack  # noqa: E402
from app.services.task_jobs import TaskJobService  # noqa: E402

LEGACY_CLASS_NAME = "\u8ba1\u79d12301\u73ed"


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    db_path = tmp_path / "test_app.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Importing the ORM classes above ensures every table is registered on Base.
    Base.metadata.create_all(bind=engine)

    db = session_local()
    try:
        _seed_demo_data(db)
    finally:
        db.close()

    def override_get_db() -> Generator[Session, None, None]:
        test_db = session_local()
        try:
            yield test_db
        finally:
            test_db.close()

    monkeypatch.setattr(main, "init_db", lambda: None)
    _stub_llm_calls(monkeypatch)
    main.app.dependency_overrides[database.get_db] = override_get_db
    main.app.state.task_jobs = TaskJobService(session_factory=session_local, max_workers=1)

    with TestClient(main.app) as test_client:
        yield test_client

    main.app.dependency_overrides.clear()
    main.app.state.task_jobs = None
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _stub_llm_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_ask_course_assistant(**kwargs):
        question = str(kwargs.get("question") or "").strip()
        course_name = str(kwargs.get("course_name") or "Demo Course").strip() or "Demo Course"
        return {
            "answer": f"[stub] {course_name}: {question or 'assistant response'}",
            "sources": ["stub-course-context"],
            "used_model_name": "stub-llm",
            "used_model_key": "default",
        }

    def _fake_generate_material_update(material_text: str, instructions: str, course_name: str = "", model_key: str = "default"):
        title = course_name or "Demo Course"
        summary = f"[stub] update for {title}: {instructions or material_text[:40] or 'refresh materials'}"
        return {
            "summary": summary,
            "update_suggestions": [
                f"Stub update: {instructions or 'Refresh examples'}"
            ],
            "draft_pages": [
                f"Stub Page: {material_text[:200] or 'Stub course material page'}"
            ],
            "image_suggestions": [
                "Stub illustration"
            ],
            "selected_model": model_key,
            "used_model_name": "stub-llm",
            "model_status": "ok",
        }

    def _fake_generate_lesson_pack(course):
        return mock_generate_lesson_pack(course)

    def _fake_student_qa(*args, **kwargs):
        return {
            "answer": "[stub] student qa response",
            "references": ["stub-lesson-pack"],
            "used_model_name": "stub-llm",
            "used_model_key": "default",
        }

    def _fake_assignment_review_preview(*args, **kwargs):
        return {
            "overall_comment": "[stub] review",
            "strengths": ["Clear structure"],
            "improvements": ["Add one more example"],
            "score": 92,
            "used_model_name": "stub-llm",
            "model_status": "ok",
        }

    def _fake_analytics_from_qa_logs(*args, **kwargs):
        return {
            "summary": "[stub] analytics summary",
            "insights": ["Students ask about core concepts"],
            "recommendations": ["Add one recap slide"],
            "used_model_name": "stub-llm",
        }

    monkeypatch.setattr(discussion_service, "ask_course_assistant", _fake_ask_course_assistant)
    monkeypatch.setattr(qa_service, "ask_course_assistant", _fake_ask_course_assistant)
    monkeypatch.setattr(llm_service, "ask_course_assistant", _fake_ask_course_assistant)
    monkeypatch.setattr(llm_service, "generate_material_update", _fake_generate_material_update)
    monkeypatch.setattr(llm_service, "generate_lesson_pack", _fake_generate_lesson_pack)
    monkeypatch.setattr(llm_service, "student_qa", _fake_student_qa)
    monkeypatch.setattr(llm_service, "assignment_review_preview", _fake_assignment_review_preview)
    monkeypatch.setattr(llm_service, "analytics_from_qa_logs", _fake_analytics_from_qa_logs)
    monkeypatch.setattr(task_job_handlers, "generate_material_update", _fake_generate_material_update)
    monkeypatch.setattr(task_job_handlers, "llm_generate_lesson_pack", _fake_generate_lesson_pack)


def _seed_demo_data(db: Session) -> None:
    now = datetime.now().isoformat()

    # Core demo accounts expected by existing smoke tests.
    teacher_user = DBUser(
        id="user-teacher-demo",
        role="teacher",
        account="teacher_demo",
        password_hash=hash_password("Teacher123!"),
        display_name="Teacher Demo",
        status="active",
        created_at=now,
    )
    student_user = DBUser(
        id="user-student-demo",
        role="student",
        account="student_demo",
        password_hash=hash_password("Student123!"),
        display_name="Student Demo",
        status="active",
        created_at=now,
    )
    admin_user = DBUser(
        id="user-admin-demo",
        role="admin",
        account="admin_demo",
        password_hash=hash_password("Admin123!"),
        display_name="Admin Demo",
        status="active",
        created_at=now,
    )
    db.add_all([teacher_user, student_user, admin_user])
    db.flush()

    db.add_all(
        [
            DBUserProfile(
                user_id="user-teacher-demo",
                real_name="Teacher Demo",
                college="Computing School",
                department="Networking Lab",
                class_name="Teacher Group",
                teacher_no="T2024001",
                email="teacher_demo@example.com",
                created_at=now,
                updated_at=now,
            ),
            DBUserProfile(
                user_id="user-student-demo",
                real_name="Student Demo",
                college="Computing School",
                major="Computer Science",
                grade="2023",
                class_name=LEGACY_CLASS_NAME,
                student_no="20230001",
                email="student_demo@example.com",
                created_at=now,
                updated_at=now,
            ),
            DBUserProfile(
                user_id="user-admin-demo",
                real_name="Admin Demo",
                college="Operations Center",
                email="admin_demo@example.com",
                created_at=now,
                updated_at=now,
            ),
        ]
    )

    # Legacy compatibility course used by many pre-existing tests.
    course = DBCourse(
        id="course-demo-001",
        name="Computer Networks",
        audience=LEGACY_CLASS_NAME,
        class_name=LEGACY_CLASS_NAME,
        student_level="undergraduate",
        chapter="Introduction",
        objectives="Understand core networking concepts",
        duration_minutes=90,
        frontier_direction="Intelligent Networking",
        owner_user_id="user-teacher-demo",
        created_at=now,
    )
    lesson_pack = DBLessonPack(
        id="lp-demo-001",
        course_id="course-demo-001",
        version=1,
        status="published",
        payload=json.dumps(
            {
                "frontier_topic": {"title": "Intelligent Networking"},
                "teaching_objectives": ["Understand core networking concepts"],
                "main_thread": "Networking fundamentals with modern extensions",
            },
            ensure_ascii=False,
        ),
        created_at=now,
    )
    survey_template = DBSurveyTemplate(
        id="survey-template-default",
        name="Default Classroom Feedback",
        description="Seeded survey template for tests",
        questions_json='[{"id":"q_rating","type":"rating","title":"Overall understanding"},{"id":"q_choice","type":"choice","title":"Area to strengthen"},{"id":"q_text","type":"text","title":"Other suggestions"}]',
        created_at=now,
    )
    db.add_all([course, lesson_pack, survey_template])

    # Explicitly touch these tables so task job worker sessions see them.
    db.add(DBTaskJob(id="task-seed", job_type="seed", owner_user_id="user-admin-demo", owner_role="admin", course_id="", status="succeeded", progress=100, message="seed", input_json="{}", result_json="{}", error_message="", created_at=now, updated_at=now, started_at=now, finished_at=now))
    db.add(DBMaterialUpdateJob(id="mu-seed", teacher_id="user-teacher-demo", course_id="course-demo-001", title="seed", source_filename="", source_file_path="", instructions="", selected_model="default", used_model_name="", model_status="ok", result_summary="", result_outline="[]", result_pages="[]", image_suggestions="[]", created_at=now))
    db.flush()
    db.query(DBTaskJob).filter(DBTaskJob.id == "task-seed").delete(synchronize_session=False)
    db.query(DBMaterialUpdateJob).filter(DBMaterialUpdateJob.id == "mu-seed").delete(synchronize_session=False)

    # Seed the registrar-style demo data used by the new academic flow.
    seed_demo_school_data(db)

    student_profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == "user-student-demo").first()
    if student_profile:
        student_profile.class_name = LEGACY_CLASS_NAME
        student_profile.updated_at = now

    # Add a legacy-compatible offering, enrollment, and discussion space for course-demo-001.
    school_class = db.query(DBSchoolClass).filter(DBSchoolClass.name == LEGACY_CLASS_NAME).first()
    if not school_class:
        school_class = DBSchoolClass(
            id="class-cs2301",
            name=LEGACY_CLASS_NAME,
            college="Computing School",
            major="Computer Science",
            grade="2023",
            year="2023",
            status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(school_class)
        db.flush()

    academic_course = db.query(DBAcademicCourse).filter(DBAcademicCourse.code == "COURSE-DEMO-001").first()
    if not academic_course:
        academic_course = DBAcademicCourse(
            id="ac-course-demo-001",
            name="Computer Networks",
            code="COURSE-DEMO-001",
            description="Compatibility academic course for tests",
            credit="2.0",
            department="Computing School",
            status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(academic_course)
        db.flush()

    discussion_space = db.query(DBDiscussionSpace).filter(DBDiscussionSpace.id == "space-demo-001").first()
    if not discussion_space:
        discussion_space = DBDiscussionSpace(
            id="space-demo-001",
            course_id="course-demo-001",
            offering_id="off-demo-001",
            class_name=LEGACY_CLASS_NAME,
            space_name="Computer Networks Discussion Space",
            ai_assistant_enabled=1,
            created_at=now,
        )
        db.add(discussion_space)
        db.flush()

    offering = db.query(DBCourseOffering).filter(DBCourseOffering.id == "off-demo-001").first()
    if not offering:
        offering = DBCourseOffering(
            id="off-demo-001",
            academic_course_id=academic_course.id,
            course_id="course-demo-001",
            teacher_user_id="user-teacher-demo",
            class_id=school_class.id,
            semester="2025-2026-2",
            invite_code="DEBUG-LEGACY",
            join_enabled=0,
            discussion_space_id="space-demo-001",
            status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(offering)

    enrollment = db.query(DBCourseEnrollment).filter(DBCourseEnrollment.offering_id == "off-demo-001", DBCourseEnrollment.student_user_id == "user-student-demo").first()
    if not enrollment:
        db.add(
            DBCourseEnrollment(
                id="enroll-demo-001",
                offering_id="off-demo-001",
                student_user_id="user-student-demo",
                class_id=school_class.id,
                source="admin_seed",
                status="active",
                joined_at=now,
                created_at=now,
            )
        )

    if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == "space-demo-001", DBDiscussionSpaceMember.user_id == "user-teacher-demo").first():
        db.add(DBDiscussionSpaceMember(id="space-member-teacher-demo", space_id="space-demo-001", user_id="user-teacher-demo", role_in_space="teacher", joined_at=now))
    if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == "space-demo-001", DBDiscussionSpaceMember.user_id == "user-student-demo").first():
        db.add(DBDiscussionSpaceMember(id="space-member-student-demo", space_id="space-demo-001", user_id="user-student-demo", role_in_space="student", joined_at=now))

    db.commit()
