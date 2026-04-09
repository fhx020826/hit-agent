"""Appearance settings routes."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import DBAppearanceSetting, get_db
from ..models.schemas import AppearanceSetting, AppearanceSettingBase
from ..security import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _row_to_setting(row: DBAppearanceSetting, user_role: str, user_id: str) -> AppearanceSetting:
    return AppearanceSetting(
        user_role=user_role,
        user_id=user_id,
        mode=row.mode,
        accent=row.accent,
        font=row.font,
        skin=row.skin,
        language=row.language or "zh-CN",
        updated_at=row.updated_at or datetime.now().isoformat(),
    )


@router.get("/me", response_model=AppearanceSetting)
def get_my_appearance(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(DBAppearanceSetting).filter(DBAppearanceSetting.user_role == current_user["role"], DBAppearanceSetting.user_id == current_user["id"]).first()
    if not row:
        return AppearanceSetting(user_role=current_user["role"], user_id=current_user["id"], mode="day", accent="blue", font="default", skin="clean", language="zh-CN", updated_at=datetime.now().isoformat())
    return _row_to_setting(row, current_user["role"], current_user["id"])


@router.put("/me", response_model=AppearanceSetting)
def update_my_appearance(body: AppearanceSettingBase, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(DBAppearanceSetting).filter(DBAppearanceSetting.user_role == current_user["role"], DBAppearanceSetting.user_id == current_user["id"]).first()
    if not row:
        row = DBAppearanceSetting(user_role=current_user["role"], user_id=current_user["id"])
        db.add(row)
    row.mode = body.mode
    row.accent = body.accent
    row.font = body.font
    row.skin = body.skin
    row.language = body.language
    row.updated_at = datetime.now().isoformat()
    db.commit()
    db.refresh(row)
    return _row_to_setting(row, current_user["role"], current_user["id"])


@router.get("/{user_role}/{user_id}", response_model=AppearanceSetting)
def get_appearance(user_role: str, user_id: str, db: Session = Depends(get_db)):
    row = db.query(DBAppearanceSetting).filter(DBAppearanceSetting.user_role == user_role, DBAppearanceSetting.user_id == user_id).first()
    if not row:
        return AppearanceSetting(user_role=user_role, user_id=user_id, mode="day", accent="blue", font="default", skin="clean", language="zh-CN", updated_at=datetime.now().isoformat())
    return _row_to_setting(row, user_role, user_id)


@router.put("/{user_role}/{user_id}", response_model=AppearanceSetting)
def update_appearance(user_role: str, user_id: str, body: AppearanceSettingBase, db: Session = Depends(get_db)):
    row = db.query(DBAppearanceSetting).filter(DBAppearanceSetting.user_role == user_role, DBAppearanceSetting.user_id == user_id).first()
    if not row:
        row = DBAppearanceSetting(user_role=user_role, user_id=user_id)
        db.add(row)
    row.mode = body.mode
    row.accent = body.accent
    row.font = body.font
    row.skin = body.skin
    row.language = body.language
    row.updated_at = datetime.now().isoformat()
    db.commit()
    db.refresh(row)
    return _row_to_setting(row, user_role, user_id)
