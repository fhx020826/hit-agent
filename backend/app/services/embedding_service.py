from __future__ import annotations

import hashlib
import math
import os
import re
import time
from typing import List, Sequence, Tuple

import httpx


TOKEN_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9_-]{1,}|[\u4e00-\u9fa5]{1,8}")


def _env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return default


EMBEDDING_BASE_URL = _env("EMBEDDING_BASE_URL", "HUNYUAN_EMBEDDING_BASE_URL", "LLM_BASE_URL")
_RAW_EMBEDDING_API_KEY = _env("EMBEDDING_API_KEY", default="")
_RAW_HUNYUAN_API_KEY = _env("HUNYUAN_API_KEY", default="")
if "api.hunyuan.cloud.tencent.com" in (EMBEDDING_BASE_URL or "") and _RAW_HUNYUAN_API_KEY:
    EMBEDDING_API_KEY = _RAW_HUNYUAN_API_KEY
else:
    EMBEDDING_API_KEY = _RAW_EMBEDDING_API_KEY or _RAW_HUNYUAN_API_KEY or _env("LLM_API_KEY", "OPENAI_API_KEY", default="")
EMBEDDING_MODEL = _env("EMBEDDING_MODEL", "HUNYUAN_EMBEDDING_MODEL", default="")
EMBEDDING_TIMEOUT = float(_env("EMBEDDING_TIMEOUT", default="25") or "25")
LOCAL_EMBEDDING_DIM = int(_env("LOCAL_EMBEDDING_DIM", default="192") or "192")
EMBEDDING_BATCH_SIZE = int(_env("EMBEDDING_BATCH_SIZE", default="12") or "12")
EMBEDDING_MAX_RETRIES = int(_env("EMBEDDING_MAX_RETRIES", default="4") or "4")
EMBEDDING_RETRY_BASE_SECONDS = float(_env("EMBEDDING_RETRY_BASE_SECONDS", default="1.2") or "1.2")
EMBEDDING_QPS_DELAY_SECONDS = float(_env("EMBEDDING_QPS_DELAY_SECONDS", default="0.45") or "0.45")


if not EMBEDDING_MODEL and "api.hunyuan.cloud.tencent.com" in (EMBEDDING_BASE_URL or ""):
    EMBEDDING_MODEL = "hunyuan-embedding"


def _normalize_embeddings_endpoint(base_url: str) -> str:
    normalized = (base_url or "").strip().rstrip("/")
    if not normalized:
        return ""
    if normalized.endswith("/embeddings"):
        return normalized
    if normalized.endswith("/chat/completions"):
        return normalized[: -len("/chat/completions")] + "/embeddings"
    if normalized.endswith("/v1") or normalized.endswith("/v4"):
        return normalized + "/embeddings"
    return normalized + "/embeddings"


def _normalize_vector(vector: Sequence[float]) -> List[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm <= 1e-12:
        return [0.0 for _ in vector]
    return [float(value / norm) for value in vector]


def _tokenize(text: str) -> List[str]:
    return TOKEN_PATTERN.findall((text or "").lower())


def _local_embedding(text: str, dim: int = 192) -> List[float]:
    vector = [0.0] * max(32, dim)
    tokens = _tokenize(text)
    if not tokens:
        return vector
    for idx, token in enumerate(tokens):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        bucket = int.from_bytes(digest[:4], "little") % len(vector)
        sign = 1.0 if (digest[4] & 1) else -1.0
        weight = 1.0 + (digest[5] / 255.0) * 0.5
        vector[bucket] += sign * weight * (1.0 + min(idx, 50) * 0.01)
    return _normalize_vector(vector)


def _remote_enabled() -> bool:
    return bool(EMBEDDING_MODEL and EMBEDDING_API_KEY and EMBEDDING_BASE_URL)


def get_embedding_runtime_model() -> str:
    return EMBEDDING_MODEL if _remote_enabled() else "local-hash-embedding"


def _remote_embeddings(texts: List[str]) -> List[List[float]]:
    endpoint = _normalize_embeddings_endpoint(EMBEDDING_BASE_URL)
    if not endpoint:
        raise RuntimeError("Embedding endpoint is empty")
    with httpx.Client(timeout=EMBEDDING_TIMEOUT, trust_env=True) as client:
        response = client.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {EMBEDDING_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": EMBEDDING_MODEL,
                "input": texts,
            },
        )
    response.raise_for_status()
    payload = response.json()
    data = payload.get("data", [])
    if not isinstance(data, list) or not data:
        raise RuntimeError("Embedding response has no data")
    ordered = sorted(data, key=lambda item: int(item.get("index", 0)))
    vectors: List[List[float]] = []
    for item in ordered:
        emb = item.get("embedding", [])
        if not isinstance(emb, list) or not emb:
            raise RuntimeError("Invalid embedding vector")
        vectors.append(_normalize_vector([float(value) for value in emb]))
    return vectors


def _remote_embeddings_with_retry(texts: List[str]) -> List[List[float]]:
    attempt = 0
    while True:
        attempt += 1
        try:
            return _remote_embeddings(texts)
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code if exc.response is not None else 0
            if status != 429 or attempt > EMBEDDING_MAX_RETRIES:
                raise
            detail = ""
            if exc.response is not None:
                try:
                    detail = (exc.response.text or "").strip()
                except Exception:
                    detail = ""
            retry_after = 0.0
            if exc.response is not None:
                raw = (exc.response.headers.get("Retry-After") or "").strip()
                if raw:
                    try:
                        retry_after = float(raw)
                    except Exception:
                        retry_after = 0.0
            backoff = EMBEDDING_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            sleep_seconds = max(retry_after, backoff)
            if detail:
                detail = detail[:300].replace("\n", " ")
            print(
                f"[EMBED] 429 rate limit hit, retry {attempt}/{EMBEDDING_MAX_RETRIES} in {sleep_seconds:.2f}s; "
                f"detail={detail or 'n/a'}",
            )
            time.sleep(sleep_seconds)
        except Exception:
            if attempt > EMBEDDING_MAX_RETRIES:
                raise
            backoff = EMBEDDING_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            print(f"[EMBED] transient embedding error, retry {attempt}/{EMBEDDING_MAX_RETRIES} in {backoff:.2f}s")
            time.sleep(backoff)


def generate_embeddings(texts: List[str]) -> Tuple[List[List[float]], str]:
    clean_texts = [(text or "").strip() for text in texts]
    if not clean_texts:
        return [], "local-hash-embedding"

    if _remote_enabled():
        try:
            vectors: List[List[float]] = []
            batch_size = max(1, EMBEDDING_BATCH_SIZE)
            for start in range(0, len(clean_texts), batch_size):
                part = clean_texts[start : start + batch_size]
                vectors.extend(_remote_embeddings_with_retry(part))
                if EMBEDDING_QPS_DELAY_SECONDS > 0 and start + batch_size < len(clean_texts):
                    time.sleep(EMBEDDING_QPS_DELAY_SECONDS)
            if len(vectors) == len(clean_texts):
                return vectors, EMBEDDING_MODEL
            print(
                f"[EMBED] remote mismatch: expected={len(clean_texts)} got={len(vectors)} "
                f"endpoint={_normalize_embeddings_endpoint(EMBEDDING_BASE_URL)} model={EMBEDDING_MODEL}; fallback local.",
            )
        except Exception as exc:
            print(
                f"[EMBED] remote request failed: endpoint={_normalize_embeddings_endpoint(EMBEDDING_BASE_URL)} "
                f"model={EMBEDDING_MODEL}; error={exc}; fallback local.",
            )

    vectors = [_local_embedding(text, dim=LOCAL_EMBEDDING_DIM) for text in clean_texts]
    return vectors, "local-hash-embedding"


def generate_text_embedding(text: str) -> Tuple[List[float], str]:
    vectors, model_name = generate_embeddings([text])
    if vectors:
        return vectors[0], model_name
    return _local_embedding("", dim=LOCAL_EMBEDDING_DIM), model_name


def cosine_similarity(vec_a: Sequence[float], vec_b: Sequence[float]) -> float:
    if not vec_a or not vec_b:
        return 0.0
    length = min(len(vec_a), len(vec_b))
    if length <= 0:
        return 0.0
    score = 0.0
    for index in range(length):
        score += float(vec_a[index]) * float(vec_b[index])
    return score
