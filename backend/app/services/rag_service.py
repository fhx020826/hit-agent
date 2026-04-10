from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any, Dict, List
from uuid import uuid4

from sqlalchemy.orm import Session

from ..database import DBKnowledgeChunk, DBLessonPack, DBMaterial
from .embedding_service import cosine_similarity, generate_embeddings, generate_text_embedding, get_embedding_runtime_model


TOKEN_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9_-]{1,}|[\u4e00-\u9fa5]{2,8}")


def _normalize_text(text: str) -> str:
    clean = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    clean = re.sub(r"\n{3,}", "\n\n", clean)
    return clean.strip()


def _extract_tokens(text: str, max_tokens: int = 80) -> List[str]:
    seen: set[str] = set()
    result: List[str] = []
    for token in TOKEN_PATTERN.findall((text or "").lower()):
        if token in seen:
            continue
        seen.add(token)
        result.append(token)
        if len(result) >= max_tokens:
            break
    return result


def split_chunks(text: str, chunk_size: int = 800, overlap: int = 120) -> List[str]:
    clean = _normalize_text(text)
    if not clean:
        return []
    if len(clean) <= chunk_size:
        return [clean]

    chunks: List[str] = []
    step = max(120, chunk_size - overlap)
    start = 0
    while start < len(clean):
        end = min(len(clean), start + chunk_size)
        segment = clean[start:end].strip()
        if segment:
            chunks.append(segment)
        if end >= len(clean):
            break
        start += step
    return chunks


def _replace_source_chunks(db: Session, source_type: str, source_id: str, rows: List[DBKnowledgeChunk]) -> None:
    db.query(DBKnowledgeChunk).filter(DBKnowledgeChunk.source_type == source_type, DBKnowledgeChunk.source_id == source_id).delete(
        synchronize_session=False,
    )
    for row in rows:
        db.add(row)
    db.flush()


def _source_key(item: Dict[str, Any]) -> str:
    return f"{item.get('source_type', '')}:{item.get('source_id', '')}"


def _keyword_jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


def _to_public_chunk(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "chunk_id": item["chunk_id"],
        "source_type": item["source_type"],
        "source_id": item["source_id"],
        "source_name": item["source_name"],
        "chunk_index": item["chunk_index"],
        "score": item["score"],
        "snippet": item["snippet"],
    }


def _safe_parse_embedding(raw: str) -> List[float]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            return []
        return [float(value) for value in parsed]
    except Exception:
        return []


def _backfill_embeddings(rows: List[DBKnowledgeChunk]) -> int:
    if not rows:
        return 0
    total = 0
    batch_size = 64
    now = datetime.now().isoformat()
    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        texts = [(row.chunk_text or "") for row in batch]
        vectors, embedding_model = generate_embeddings(texts)
        for idx, row in enumerate(batch):
            vector = vectors[idx] if idx < len(vectors) else []
            row.embedding_json = json.dumps(vector, ensure_ascii=False)
            row.embedding_model = embedding_model
            row.embedding_updated_at = now
            row.updated_at = now
            total += 1
    return total


def upsert_chunks_for_material(db: Session, material: DBMaterial, content_text: str | None = None) -> int:
    source_id = str(material.id)
    text = _normalize_text(content_text if content_text is not None else (material.content or ""))
    if not text:
        _replace_source_chunks(db, "material", source_id, [])
        return 0

    chunks = split_chunks(text, chunk_size=900, overlap=140)
    vectors, embedding_model = generate_embeddings(chunks)
    now = datetime.now().isoformat()
    rows: List[DBKnowledgeChunk] = []
    for idx, chunk_text in enumerate(chunks):
        vector = vectors[idx] if idx < len(vectors) else []
        rows.append(
            DBKnowledgeChunk(
                id=f"kchunk-{uuid4().hex[:12]}",
                course_id=material.course_id,
                source_type="material",
                source_id=source_id,
                source_name=material.filename or f"材料 {source_id}",
                chunk_index=idx,
                chunk_text=chunk_text,
                keywords_json=json.dumps(_extract_tokens(chunk_text), ensure_ascii=False),
                embedding_json=json.dumps(vector, ensure_ascii=False),
                embedding_model=embedding_model,
                embedding_updated_at=now,
                meta_json=json.dumps({"file_type": material.file_type, "uploader_user_id": material.uploader_user_id}, ensure_ascii=False),
                created_at=now,
                updated_at=now,
            )
        )
    _replace_source_chunks(db, "material", source_id, rows)
    return len(rows)


def _lesson_pack_text(payload: Any) -> str:
    if payload is None:
        return ""
    if isinstance(payload, dict):
        return json.dumps(payload, ensure_ascii=False)
    if isinstance(payload, list):
        return json.dumps(payload, ensure_ascii=False)
    return str(payload)


def upsert_chunks_for_lesson_pack(db: Session, lesson_pack: DBLessonPack) -> int:
    source_id = lesson_pack.id
    text = _normalize_text(_lesson_pack_text(lesson_pack.payload))
    if not text:
        _replace_source_chunks(db, "lesson_pack", source_id, [])
        return 0

    chunks = split_chunks(text, chunk_size=1000, overlap=180)
    vectors, embedding_model = generate_embeddings(chunks)
    now = datetime.now().isoformat()
    rows: List[DBKnowledgeChunk] = []
    for idx, chunk_text in enumerate(chunks):
        vector = vectors[idx] if idx < len(vectors) else []
        rows.append(
            DBKnowledgeChunk(
                id=f"kchunk-{uuid4().hex[:12]}",
                course_id=lesson_pack.course_id,
                source_type="lesson_pack",
                source_id=source_id,
                source_name=f"课程包 {lesson_pack.id}",
                chunk_index=idx,
                chunk_text=chunk_text,
                keywords_json=json.dumps(_extract_tokens(chunk_text), ensure_ascii=False),
                embedding_json=json.dumps(vector, ensure_ascii=False),
                embedding_model=embedding_model,
                embedding_updated_at=now,
                meta_json=json.dumps({"status": lesson_pack.status, "version": lesson_pack.version}, ensure_ascii=False),
                created_at=now,
                updated_at=now,
            )
        )
    _replace_source_chunks(db, "lesson_pack", source_id, rows)
    return len(rows)


def retrieve_relevant_chunks(db: Session, *, course_id: str, query_text: str, top_k: int = 6) -> List[Dict[str, Any]]:
    if not course_id or not (query_text or "").strip():
        return []

    top_k = max(1, int(top_k or 1))
    query_tokens = set(_extract_tokens(query_text, max_tokens=60))
    query_vector, _ = generate_text_embedding(query_text)
    rows = (
        db.query(DBKnowledgeChunk)
        .filter(DBKnowledgeChunk.course_id == course_id)
        .order_by(DBKnowledgeChunk.updated_at.desc())
        .limit(1200)
        .all()
    )
    if not rows:
        return []

    scored: List[Dict[str, Any]] = []
    for row in rows:
        chunk_text = row.chunk_text or ""
        if not chunk_text:
            continue

        try:
            chunk_keywords = set(json.loads(row.keywords_json or "[]"))
        except Exception:
            chunk_keywords = set()

        overlap = len(query_tokens & chunk_keywords)
        lower_text = chunk_text.lower()
        contains_hits = sum(1 for token in query_tokens if token in lower_text)
        lexical_raw = overlap * 6 + contains_hits * 1.2

        chunk_vector = _safe_parse_embedding(getattr(row, "embedding_json", "") or "")
        vector_raw = max(0.0, cosine_similarity(query_vector, chunk_vector)) if chunk_vector else 0.0

        snippet = chunk_text if len(chunk_text) <= 520 else chunk_text[:520] + "..."
        scored.append(
            {
                "chunk_id": row.id,
                "source_type": row.source_type,
                "source_id": row.source_id,
                "source_name": row.source_name or ("课程包" if row.source_type == "lesson_pack" else "教学资料"),
                "chunk_index": int(row.chunk_index or 0),
                "snippet": snippet,
                "_keywords": chunk_keywords,
                "_lexical": float(lexical_raw),
                "_vector": float(vector_raw),
                "_source_bias": 0.04 if row.source_type == "lesson_pack" else 0.02,
            }
        )

    if not scored:
        return []

    max_lex = max((item["_lexical"] for item in scored), default=0.0)
    max_vec = max((item["_vector"] for item in scored), default=0.0)
    for item in scored:
        lexical_norm = (item["_lexical"] / max_lex) if max_lex > 1e-9 else 0.0
        vector_norm = (item["_vector"] / max_vec) if max_vec > 1e-9 else 0.0
        fused = lexical_norm * 0.62 + vector_norm * 0.38 + item["_source_bias"]
        item["_fused"] = fused
        item["score"] = round(float(fused * 100), 3)

    scored.sort(key=lambda item: item["_fused"], reverse=True)
    top_fused = float(scored[0]["_fused"])
    min_fused = max(0.14, top_fused * 0.30)
    pool = [item for item in scored if float(item["_fused"]) >= min_fused]
    if not pool:
        pool = scored[: max(top_k * 4, top_k)]

    max_per_source = 1 if top_k <= 4 else 2
    selected: List[Dict[str, Any]] = []
    source_counts: Dict[str, int] = {}

    while pool and len(selected) < top_k:
        best_idx = -1
        best_value = float("-inf")
        for idx, candidate in enumerate(pool):
            source = _source_key(candidate)
            source_count = source_counts.get(source, 0)
            if source_count >= max_per_source:
                continue

            novelty_penalty = 0.0
            if selected:
                cand_kw = candidate.get("_keywords", set())
                novelty_penalty = max(_keyword_jaccard(cand_kw, picked.get("_keywords", set())) for picked in selected)

            new_source_bonus = 0.05 if source_count == 0 else 0.0
            same_source_penalty = 0.08 * source_count
            value = float(candidate["_fused"]) * (1 - 0.28 * novelty_penalty) + new_source_bonus - same_source_penalty
            if value > best_value:
                best_value = value
                best_idx = idx

        if best_idx < 0:
            break

        chosen = pool.pop(best_idx)
        selected.append(chosen)
        source = _source_key(chosen)
        source_counts[source] = source_counts.get(source, 0) + 1

    if not selected:
        selected = scored[:top_k]

    return [_to_public_chunk(item) for item in selected[:top_k]]


def ensure_course_chunk_index(db: Session, course_id: str) -> int:
    if not course_id:
        return 0
    exists = db.query(DBKnowledgeChunk).filter(DBKnowledgeChunk.course_id == course_id).first()
    if exists:
        target_embedding_model = get_embedding_runtime_model()
        missing_rows = (
            db.query(DBKnowledgeChunk)
            .filter(DBKnowledgeChunk.course_id == course_id)
            .filter((DBKnowledgeChunk.embedding_json == "") | (DBKnowledgeChunk.embedding_json.is_(None)))
            .limit(600)
            .all()
        )
        if target_embedding_model != "local-hash-embedding":
            outdated_rows = (
                db.query(DBKnowledgeChunk)
                .filter(DBKnowledgeChunk.course_id == course_id)
                .filter((DBKnowledgeChunk.embedding_model != target_embedding_model) | (DBKnowledgeChunk.embedding_model == "") | (DBKnowledgeChunk.embedding_model.is_(None)))
                .limit(600)
                .all()
            )
            row_map: Dict[str, DBKnowledgeChunk] = {}
            for row in missing_rows + outdated_rows:
                row_map[row.id] = row
            return _backfill_embeddings(list(row_map.values()))
        return _backfill_embeddings(missing_rows)

    created = 0
    materials = (
        db.query(DBMaterial)
        .filter(DBMaterial.course_id == course_id)
        .order_by(DBMaterial.created_at.desc())
        .all()
    )
    for material in materials:
        created += upsert_chunks_for_material(db, material)

    lesson_packs = (
        db.query(DBLessonPack)
        .filter(DBLessonPack.course_id == course_id)
        .order_by(DBLessonPack.created_at.desc())
        .limit(3)
        .all()
    )
    for lesson_pack in lesson_packs:
        created += upsert_chunks_for_lesson_pack(db, lesson_pack)

    return created
