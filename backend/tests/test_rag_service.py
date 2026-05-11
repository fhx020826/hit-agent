from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, DBCourse, DBKnowledgeChunk, DBLessonPack
from app.services import rag_service


def _session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return engine, sessionmaker(autocommit=False, autoflush=False, bind=engine)


def test_split_chunks_prefers_sentence_boundaries() -> None:
    text = (
        "Part one introduces the course background and learning goals. "
        "Part two explains why retrieval augmentation should combine lexical matching and semantic similarity. "
        "Part three provides a short case study and summary."
    )

    chunks = rag_service.split_chunks(text, chunk_size=72, overlap=12)

    assert len(chunks) >= 2
    assert chunks[0].endswith((".", "!", "?"))
    assert "retrieval augmentation" in " ".join(chunks).lower()


def test_retrieve_relevant_chunks_expands_adjacent_context() -> None:
    engine, session_local = _session_factory()
    db = session_local()
    now = datetime.now().isoformat()
    try:
        db.add_all(
            [
                DBKnowledgeChunk(
                    id="k1",
                    course_id="course-demo-001",
                source_type="material",
                source_id="mat-1",
                source_name="network-notes.md",
                chunk_index=0,
                chunk_text="This section introduces network layers and basic concepts.",
                keywords_json=json.dumps(["network", "layers", "basic"], ensure_ascii=False),
                embedding_json="[]",
                embedding_model="local",
                embedding_updated_at=now,
                    meta_json="{}",
                    created_at=now,
                    updated_at=now,
                ),
                DBKnowledgeChunk(
                    id="k2",
                    course_id="course-demo-001",
                source_type="material",
                source_id="mat-1",
                source_name="network-notes.md",
                chunk_index=1,
                chunk_text="HTTP connection reuse reduces repeated handshakes and improves page loading efficiency.",
                keywords_json=json.dumps(["http", "connection", "reuse", "loading"], ensure_ascii=False),
                embedding_json="[]",
                embedding_model="local",
                embedding_updated_at=now,
                    meta_json="{}",
                    created_at=now,
                    updated_at=now,
                ),
                DBKnowledgeChunk(
                    id="k3",
                    course_id="course-demo-001",
                source_type="material",
                source_id="mat-1",
                source_name="network-notes.md",
                chunk_index=2,
                chunk_text="This mechanism is usually discussed together with keep-alive and concurrent requests.",
                keywords_json=json.dumps(["keep-alive", "concurrent", "requests"], ensure_ascii=False),
                embedding_json="[]",
                embedding_model="local",
                embedding_updated_at=now,
                    meta_json="{}",
                    created_at=now,
                    updated_at=now,
                ),
            ],
        )
        db.commit()

        results = rag_service.retrieve_relevant_chunks(
            db,
            course_id="course-demo-001",
            query_text="Why does HTTP connection reuse improve loading efficiency?",
            top_k=1,
        )

        assert len(results) == 1
        assert results[0]["source_id"] == "mat-1"
        assert "connection reuse" in results[0]["snippet"].lower()
        assert "keep-alive" in results[0]["snippet"].lower()
    finally:
        db.close()
        engine.dispose()


def test_ensure_course_chunk_index_indexes_all_lesson_packs(monkeypatch) -> None:
    engine, session_local = _session_factory()
    db = session_local()
    now = datetime.now().isoformat()
    try:
        db.add(
            DBCourse(
                id="course-demo-001",
                name="Computer Networks",
                audience="Class A",
                class_name="Class A",
                student_level="Undergrad",
                chapter="Intro",
                objectives="Understand the basics",
                duration_minutes=90,
                frontier_direction="Intelligent Networks",
                owner_user_id="user-teacher-demo",
                created_at=now,
            ),
        )
        for idx in range(4):
            db.add(
                DBLessonPack(
                    id=f"lp-demo-00{idx + 1}",
                    course_id="course-demo-001",
                    version=idx + 1,
                    status="published",
                    payload=json.dumps({"title": f"lesson-{idx + 1}", "content": f"chunk payload {idx + 1}"}, ensure_ascii=False),
                    created_at=f"2026-05-0{idx + 1}T10:00:00",
                ),
            )
        db.commit()

        monkeypatch.setattr(
            rag_service,
            "generate_embeddings",
            lambda texts: ([[0.0, 1.0] for _ in texts], "test-embedding"),
        )

        created = rag_service.ensure_course_chunk_index(db, "course-demo-001")
        db.commit()

        indexed_lesson_pack_ids = {
            row.source_id
            for row in db.query(DBKnowledgeChunk).filter(DBKnowledgeChunk.course_id == "course-demo-001", DBKnowledgeChunk.source_type == "lesson_pack").all()
        }

        assert created > 0
        assert indexed_lesson_pack_ids == {
            "lp-demo-001",
            "lp-demo-002",
            "lp-demo-003",
            "lp-demo-004",
        }
    finally:
        db.close()
        engine.dispose()
