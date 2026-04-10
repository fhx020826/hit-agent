from __future__ import annotations

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
from app.database import Base, DBCourse, DBUser, DBUserProfile
from app.security import hash_password


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    db_path = tmp_path / "test_app.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)

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
    main.app.dependency_overrides[database.get_db] = override_get_db

    with TestClient(main.app) as test_client:
        yield test_client

    main.app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _seed_demo_data(db: Session) -> None:
    now = datetime.now().isoformat()

    teacher_user = DBUser(
        id="user-teacher-demo",
        role="teacher",
        account="teacher_demo",
        password_hash=hash_password("Teacher123!"),
        display_name="张老师",
        status="active",
        created_at=now,
    )
    teacher_profile = DBUserProfile(
        user_id="user-teacher-demo",
        real_name="张老师",
        college="计算机学院",
        department="网络与信息安全教研室",
        email="teacher_demo@example.com",
        class_name="教师教研组",
        created_at=now,
        updated_at=now,
    )

    student_user = DBUser(
        id="user-student-demo",
        role="student",
        account="student_demo",
        password_hash=hash_password("Student123!"),
        display_name="李明",
        status="active",
        created_at=now,
    )
    student_profile = DBUserProfile(
        user_id="user-student-demo",
        real_name="李明",
        college="计算机学院",
        major="计算机科学与技术",
        grade="2023级",
        class_name="计科2301班",
        email="student_demo@example.com",
        created_at=now,
        updated_at=now,
    )

    course = DBCourse(
        id="course-demo-001",
        name="计算机网络",
        audience="计科2301班",
        class_name="计科2301班",
        student_level="本科",
        chapter="绪论",
        objectives="理解网络基础概念",
        duration_minutes=90,
        frontier_direction="智能网络",
        owner_user_id="user-teacher-demo",
        created_at=now,
    )

    db.add_all([teacher_user, teacher_profile, student_user, student_profile, course])
    db.commit()
