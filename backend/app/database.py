"""SQLite 数据库初始化与连接管理。"""

from __future__ import annotations

import os
from typing import Optional

from sqlalchemy import Column, String, Integer, Text, DateTime, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DB_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "app.db")

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ── ORM 模型 ─────────────────────────────────────────────

class DBCourse(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    audience = Column(String, default="")
    student_level = Column(String, default="")
    chapter = Column(String, default="")
    objectives = Column(Text, default="")
    duration_minutes = Column(Integer, default=90)
    frontier_direction = Column(String, default="")
    created_at = Column(String)


class DBLessonPack(Base):
    __tablename__ = "lesson_packs"

    id = Column(String, primary_key=True)
    course_id = Column(String, nullable=False)
    version = Column(Integer, default=1)
    status = Column(String, default="draft")
    payload = Column(Text, default="{}")
    created_at = Column(String)


class DBQALog(Base):
    __tablename__ = "qa_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lesson_pack_id = Column(String, nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, default="")
    in_scope = Column(Integer, default=1)
    created_at = Column(String)


class DBMaterial(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    content = Column(Text, default="")
    file_type = Column(String, default="")
    created_at = Column(String)


def init_db():
    """创建表并写入 demo seed 数据。"""
    Base.metadata.create_all(bind=engine)

    from .services.mock_data import get_demo_course, get_demo_lesson_pack
    import json
    from datetime import datetime

    db = SessionLocal()
    try:
        # Seed demo course if empty
        if db.query(DBCourse).count() == 0:
            c = get_demo_course()
            db.add(DBCourse(
                id=c.id, name=c.name, audience=c.audience,
                student_level=c.student_level, chapter=c.chapter,
                objectives=c.objectives, duration_minutes=c.duration_minutes,
                frontier_direction=c.frontier_direction,
                created_at=c.created_at.isoformat() if hasattr(c.created_at, "isoformat") else str(c.created_at),
            ))

        # Seed demo lesson pack if empty
        if db.query(DBLessonPack).count() == 0:
            lp = get_demo_lesson_pack()
            db.add(DBLessonPack(
                id=lp.id, course_id=lp.course_id, version=lp.version,
                status=lp.status, payload=json.dumps(lp.payload, ensure_ascii=False),
                created_at=lp.created_at.isoformat() if hasattr(lp.created_at, "isoformat") else str(lp.created_at),
            ))

        db.commit()
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
