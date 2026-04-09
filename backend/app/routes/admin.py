from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import (
    DBAssignmentReceipt,
    DBAssignmentSubmission,
    DBDiscussionMessage,
    DBDiscussionSpaceMember,
    DBMaterialRequest,
    DBQuestion,
    DBSessionToken,
    DBUser,
    DBUserProfile,
    get_db,
)
from ..models.schemas import AdminUserCreate, AdminUserItem, AdminUserUpdate
from ..security import hash_password, require_roles

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _to_user_item(user: DBUser, profile: DBUserProfile | None) -> AdminUserItem:
    return AdminUserItem(
        id=user.id,
        role=user.role,
        account=user.account,
        display_name=user.display_name,
        status=user.status,
        created_at=user.created_at,
        class_name=profile.class_name if profile else "",
        college=profile.college if profile else "",
        major=profile.major if profile else "",
        email=profile.email if profile else "",
    )


@router.get("/users", response_model=list[AdminUserItem])
def list_users(
    role: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    current_user: dict = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    query = db.query(DBUser)
    if role:
        query = query.filter(DBUser.role == role)
    rows = query.order_by(DBUser.created_at.desc()).all()
    profiles = {item.user_id: item for item in db.query(DBUserProfile).all()}
    result = [_to_user_item(row, profiles.get(row.id)) for row in rows]
    if keyword:
        text = keyword.lower()
        result = [item for item in result if text in item.display_name.lower() or text in item.account.lower() or text in (item.class_name or "").lower() or text in (item.email or "").lower()]
    return result


@router.post("/users", response_model=AdminUserItem)
def create_user(body: AdminUserCreate, current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    if db.query(DBUser).filter(DBUser.account == body.account).first():
        raise HTTPException(status_code=400, detail="该账号已存在")
    user = DBUser(
        id=f"user-{uuid4().hex[:8]}",
        role=body.role,
        account=body.account,
        password_hash=hash_password(body.password),
        display_name=body.display_name or body.profile.real_name or body.account,
        status=body.status,
        created_at=datetime.now().isoformat(),
    )
    profile = DBUserProfile(
        user_id=user.id,
        real_name=body.profile.real_name,
        gender=body.profile.gender,
        college=body.profile.college,
        major=body.profile.major,
        grade=body.profile.grade,
        class_name=body.profile.class_name,
        student_no=body.profile.student_no,
        teacher_no=body.profile.teacher_no,
        department=body.profile.department,
        teaching_group=body.profile.teaching_group,
        role_title=body.profile.role_title,
        birth_date=body.profile.birth_date,
        email=body.profile.email,
        phone=body.profile.phone,
        avatar_path=body.profile.avatar_path,
        bio=body.profile.bio,
        research_direction=body.profile.research_direction,
        interests=body.profile.interests,
        common_courses_json="[]",
        linked_classes_json="[]",
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
    )
    db.add(user)
    db.add(profile)
    db.commit()
    return _to_user_item(user, profile)


@router.put("/users/{user_id}", response_model=AdminUserItem)
def update_user(user_id: str, body: AdminUserUpdate, current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == user_id).first()
    if not profile:
        profile = DBUserProfile(user_id=user_id, created_at=datetime.now().isoformat())
        db.add(profile)
    user.display_name = body.display_name or user.display_name
    user.status = body.status
    for field, value in body.profile.model_dump().items():
        if hasattr(profile, field):
            setattr(profile, field, value)
    profile.updated_at = datetime.now().isoformat()
    db.commit()
    db.refresh(user)
    return _to_user_item(user, profile)


@router.delete("/users/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="不能删除当前管理员账号")
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    db.query(DBSessionToken).filter(DBSessionToken.user_id == user_id).delete()
    db.query(DBUserProfile).filter(DBUserProfile.user_id == user_id).delete()
    db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.user_id == user_id).delete()
    db.query(DBDiscussionMessage).filter(DBDiscussionMessage.sender_user_id == user_id).delete()
    db.query(DBQuestion).filter(DBQuestion.user_id == user_id).delete()
    db.query(DBMaterialRequest).filter(DBMaterialRequest.student_id == user_id).delete()
    db.query(DBAssignmentReceipt).filter(DBAssignmentReceipt.student_id == user_id).delete()
    db.query(DBAssignmentSubmission).filter(DBAssignmentSubmission.student_id == user_id).delete()
    db.delete(user)
    db.commit()
    return {"status": "ok"}
