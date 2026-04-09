"""Authentication helpers for the teaching platform."""

from __future__ import annotations

import hashlib
import os
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Callable, Iterable
from uuid import uuid4

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .database import DBSessionToken, DBUser, DBUserProfile, get_db

SESSION_HOURS = int(os.getenv("SESSION_HOURS", "72"))


def hash_password(password: str) -> str:
    salt = uuid4().hex
    digest = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    check = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return check == digest


def create_session_token(user_id: str, db: Session) -> str:
    token = f"sess-{uuid4().hex}"
    now = datetime.now()
    db.add(DBSessionToken(token=token, user_id=user_id, created_at=now.isoformat(), expires_at=(now + timedelta(hours=SESSION_HOURS)).isoformat()))
    db.commit()
    return token


def delete_session_token(token: str, db: Session) -> None:
    row = db.query(DBSessionToken).filter(DBSessionToken.token == token).first()
    if row:
        db.delete(row)
        db.commit()


def build_user_payload(user: DBUser, profile: DBUserProfile | None) -> dict[str, Any]:
    return {
        "id": user.id,
        "role": user.role,
        "account": user.account,
        "display_name": user.display_name or (profile.real_name if profile else user.account),
        "status": user.status,
        "created_at": user.created_at,
        "profile": {
            "real_name": profile.real_name if profile else "",
            "gender": profile.gender if profile else "",
            "college": profile.college if profile else "",
            "major": profile.major if profile else "",
            "grade": profile.grade if profile else "",
            "class_name": profile.class_name if profile else "",
            "student_no": profile.student_no if profile else "",
            "teacher_no": profile.teacher_no if profile else "",
            "department": profile.department if profile else "",
            "teaching_group": profile.teaching_group if profile else "",
            "role_title": profile.role_title if profile else "",
            "birth_date": profile.birth_date if profile else "",
            "email": profile.email if profile else "",
            "phone": profile.phone if profile else "",
            "avatar_path": profile.avatar_path if profile else "",
            "bio": profile.bio if profile else "",
            "research_direction": profile.research_direction if profile else "",
            "interests": profile.interests if profile else "",
            "common_courses_json": profile.common_courses_json if profile else "[]",
            "linked_classes_json": profile.linked_classes_json if profile else "[]",
            "updated_at": profile.updated_at if profile else "",
        },
    }


def _extract_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="未登录或登录状态已失效")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="无效的认证头")
    return authorization.split(" ", 1)[1].strip()


def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> dict[str, Any]:
    token = _extract_token(authorization)
    row = db.query(DBSessionToken).filter(DBSessionToken.token == token).first()
    if not row:
        raise HTTPException(status_code=401, detail="登录状态不存在，请重新登录")
    if row.expires_at and datetime.fromisoformat(row.expires_at) < datetime.now():
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=401, detail="登录状态已过期，请重新登录")
    user = db.query(DBUser).filter(DBUser.id == row.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == user.id).first()
    payload = build_user_payload(user, profile)
    payload["token"] = token
    return payload


def require_roles(*roles: str) -> Callable[..., dict[str, Any]]:
    def dependency(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if current_user["role"] not in roles:
            raise HTTPException(status_code=403, detail="当前账号无权限访问该资源")
        return current_user

    return dependency
