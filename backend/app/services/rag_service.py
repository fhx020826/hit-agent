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
PARAGRAPH_SPLIT_PATTERN = re.compile(r"\n\s*\n+")
SENTENCE_UNIT_PATTERN = re.compile(r".+?(?:[。！？!?；;](?:\s+|$)|\.(?=\s+[A-Z]|$)|$)", re.S)
WHITESPACE_PATTERN = re.compile(r"\s+")
SNIPPET_QUERY_WINDOW = 760
SNIPPET_MAX_LENGTH = 880
_EMBEDDING_VECTOR_CACHE: dict[str, List[float]] = {}


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


def _clip_text_around_match(text: str, query_text: str, query_tokens: set[str], max_length: int = SNIPPET_QUERY_WINDOW) -> str:
    clean = _normalize_text(text)
    if len(clean) <= max_length:
        return clean

    lower = clean.lower()
    anchor = -1
    q = (query_text or "").strip().lower()
    if q:
        anchor = lower.find(q)
    if anchor < 0:
        for token in sorted(query_tokens, key=len, reverse=True):
            anchor = lower.find(token.lower())
            if anchor >= 0:
                break

    if anchor < 0:
        return clean[:max_length].strip() + "..."

    half = max_length // 2
    start = max(0, anchor - half)
    end = min(len(clean), start + max_length)
    if end - start < max_length:
        start = max(0, end - max_length)
    snippet = clean[start:end].strip()
    if start > 0:
        snippet = "..." + snippet
    if end < len(clean):
        snippet = snippet + "..."
    return snippet


def _split_large_unit(unit: str, chunk_size: int, overlap: int) -> List[str]:
    text = unit.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    pieces: List[str] = []
    step = max(120, chunk_size - overlap)
    start = 0
    while start < len(text):
        ideal_end = min(len(text), start + chunk_size)
        if ideal_end >= len(text):
            tail = text[start:].strip()
            if tail:
                pieces.append(tail)
            break

        split_end = ideal_end
        window = text[start:ideal_end]
        boundary = max(
            window.rfind("。"),
            window.rfind("！"),
            window.rfind("？"),
            window.rfind(";"),
            window.rfind("；"),
            window.rfind("\n"),
            window.rfind(" "),
        )
        if boundary >= max(80, chunk_size // 3):
            split_end = start + boundary + 1

        segment = text[start:split_end].strip()
        if segment:
            pieces.append(segment)
        start = max(split_end, start + step)
    return pieces


def _sentence_units(paragraph: str) -> List[str]:
    matches = [item.strip() for item in SENTENCE_UNIT_PATTERN.findall(paragraph or "") if item.strip()]
    return matches or [paragraph.strip()]


def split_chunks(text: str, chunk_size: int = 800, overlap: int = 120) -> List[str]:
    clean = _normalize_text(text)
    if not clean:
        return []
    if len(clean) <= chunk_size:
        return [clean]

    units: List[str] = []
    for block in PARAGRAPH_SPLIT_PATTERN.split(clean):
        paragraph = block.strip()
        if not paragraph:
            continue
        sentences = _sentence_units(paragraph)
        for sentence in sentences:
            if len(sentence) <= chunk_size:
                units.append(sentence)
            else:
                units.extend(_split_large_unit(sentence, chunk_size=chunk_size, overlap=overlap))

    if not units:
        return _split_large_unit(clean, chunk_size=chunk_size, overlap=overlap)

    chunks: List[str] = []
    current: List[str] = []
    current_len = 0

    def flush_current() -> None:
        nonlocal current, current_len
        if not current:
            return
        segment = "\n".join(current).strip()
        if segment:
            chunks.append(segment)
        overlap_units: List[str] = []
        overlap_chars = 0
        for previous in reversed(current):
            previous_len = len(previous) + (1 if overlap_units else 0)
            if overlap_chars + previous_len > overlap:
                break
            overlap_units.insert(0, previous)
            overlap_chars += previous_len
        current = overlap_units
        current_len = sum(len(item) for item in current) + max(0, len(current) - 1)

    for unit in units:
        projected = current_len + (1 if current else 0) + len(unit)
        if current and projected > chunk_size:
            flush_current()
        current.append(unit)
        current_len = sum(len(item) for item in current) + max(0, len(current) - 1)

    if current:
        segment = "\n".join(current).strip()
        if segment:
            chunks.append(segment)

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


def _embedding_cache_key(row: DBKnowledgeChunk) -> str:
    stamp = getattr(row, "embedding_updated_at", "") or getattr(row, "updated_at", "") or ""
    return f"{row.id}:{stamp}:{len(getattr(row, 'embedding_json', '') or '')}"


def _row_embedding_vector(row: DBKnowledgeChunk) -> List[float]:
    key = _embedding_cache_key(row)
    cached = _EMBEDDING_VECTOR_CACHE.get(key)
    if cached is not None:
        return cached
    vector = _safe_parse_embedding(getattr(row, "embedding_json", "") or "")
    if len(_EMBEDDING_VECTOR_CACHE) >= 8000:
        _EMBEDDING_VECTOR_CACHE.clear()
    _EMBEDDING_VECTOR_CACHE[key] = vector
    return vector


def _source_row_key(source_type: str, source_id: str) -> str:
    return f"{source_type}:{source_id}"


def _expand_chunk_snippet(
    item: Dict[str, Any],
    source_row_maps: Dict[str, Dict[int, DBKnowledgeChunk]],
    *,
    query_text: str,
    query_tokens: set[str],
    max_length: int = SNIPPET_MAX_LENGTH,
) -> str:
    source_key = _source_row_key(str(item.get("source_type") or ""), str(item.get("source_id") or ""))
    row_map = source_row_maps.get(source_key, {})
    center_index = int(item.get("chunk_index") or 0)
    parts: List[str] = []

    for idx in range(center_index - 1, center_index + 2):
        row = row_map.get(idx)
        if not row:
            continue
        chunk_text = _normalize_text(row.chunk_text or "")
        if chunk_text:
            parts.append(chunk_text)

    if not parts:
        fallback = _normalize_text(str(item.get("snippet") or ""))
        return fallback[:max_length] + ("..." if len(fallback) > max_length else "")

    merged = "\n".join(parts)
    clipped = _clip_text_around_match(merged, query_text, query_tokens, max_length=max_length)
    return clipped if len(clipped) <= max_length + 3 else clipped[:max_length].rstrip() + "..."


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


def retrieve_relevant_chunks(
    db: Session,
    *,
    course_id: str,
    query_text: str,
    top_k: int = 6,
    allowed_material_source_ids: set[str] | None = None,
    allowed_lesson_pack_source_ids: set[str] | None = None,
) -> List[Dict[str, Any]]:
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

    source_row_maps: Dict[str, Dict[int, DBKnowledgeChunk]] = {}
    scored: List[Dict[str, Any]] = []
    normalized_query = WHITESPACE_PATTERN.sub(" ", (query_text or "").strip().lower())
    for row in rows:
        if row.source_type == "material" and allowed_material_source_ids is not None:
            if str(row.source_id) not in allowed_material_source_ids:
                continue
        if row.source_type == "lesson_pack" and allowed_lesson_pack_source_ids is not None:
            if str(row.source_id) not in allowed_lesson_pack_source_ids:
                continue
        chunk_text = row.chunk_text or ""
        if not chunk_text:
            continue

        try:
            chunk_keywords = set(json.loads(row.keywords_json or "[]"))
        except Exception:
            chunk_keywords = set()

        source_key = _source_row_key(str(row.source_type), str(row.source_id))
        source_row_maps.setdefault(source_key, {})[int(row.chunk_index or 0)] = row

        overlap = len(query_tokens & chunk_keywords)
        lower_text = chunk_text.lower()
        contains_hits = sum(1 for token in query_tokens if token in lower_text)
        source_name_lower = (row.source_name or "").lower()
        source_name_hits = sum(1 for token in query_tokens if token in source_name_lower)
        exact_phrase_hit = 1.0 if normalized_query and len(normalized_query) >= 4 and normalized_query in lower_text else 0.0
        heading_bias = 0.8 if int(row.chunk_index or 0) == 0 else max(0.0, 0.28 - min(int(row.chunk_index or 0), 12) * 0.02)
        lexical_raw = overlap * 6.2 + contains_hits * 1.35 + source_name_hits * 2.1 + exact_phrase_hit * 12.0 + heading_bias

        chunk_vector = _row_embedding_vector(row)
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
                "_source_name_hits": float(source_name_hits),
                "_exact_phrase": float(exact_phrase_hit),
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

    public_items: List[Dict[str, Any]] = []
    for item in selected[:top_k]:
        public = _to_public_chunk(item)
        public["snippet"] = _expand_chunk_snippet(
            item,
            source_row_maps,
            query_text=query_text,
            query_tokens=query_tokens,
        )
        public_items.append(public)
    return public_items


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
        .all()
    )
    for lesson_pack in lesson_packs:
        created += upsert_chunks_for_lesson_pack(db, lesson_pack)

    return created
