from __future__ import annotations

import json
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import DBUser, DBUserProfile, get_db
from ..models.schemas import AuthLoginRequest, AuthLoginResponse, AuthRegisterRequest, PasswordChangeRequest, UserProfile, UserSummary
from ..security import build_user_payload, create_session_token, delete_session_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthLoginResponse)
def register(body: AuthRegisterRequest, db: Session = Depends(get_db)):
    if body.role == "admin":
        raise HTTPException(status_code=403, detail="管理员账号仅能由系统管理员创建")
    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="两次输入的密码不一致")
    if db.query(DBUser).filter(DBUser.account == body.account).first():
        raise HTTPException(status_code=400, detail="该账号已被注册")

    user_id = f"user-{uuid4().hex[:8]}"
    user = DBUser(
        id=user_id,
        role=body.role,
        account=body.account,
        password_hash=hash_password(body.password),
        display_name=body.profile.real_name or body.account,
        status="active",
        created_at=datetime.now().isoformat(),
    )
    profile = DBUserProfile(
        user_id=user_id,
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
        common_courses_json=json.dumps(body.profile.common_courses, ensure_ascii=False),
        linked_classes_json=json.dumps(body.profile.linked_classes, ensure_ascii=False),
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
    )
    db.add(user)
    db.add(profile)
    db.commit()

    token = create_session_token(user_id, db)
    payload = build_user_payload(user, profile)
    return AuthLoginResponse(token=token, user=UserSummary(**{
        **{k: v for k, v in payload.items() if k in {"id", "role", "account", "display_name", "status", "created_at"}},
        "profile": UserProfile(**{
            "real_name": body.profile.real_name,
            "gender": body.profile.gender,
            "college": body.profile.college,
            "major": body.profile.major,
            "grade": body.profile.grade,
            "class_name": body.profile.class_name,
            "student_no": body.profile.student_no,
            "teacher_no": body.profile.teacher_no,
            "department": body.profile.department,
            "teaching_group": body.profile.teaching_group,
            "role_title": body.profile.role_title,
            "birth_date": body.profile.birth_date,
            "email": body.profile.email,
            "phone": body.profile.phone,
            "avatar_path": body.profile.avatar_path,
            "bio": body.profile.bio,
            "research_direction": body.profile.research_direction,
            "interests": body.profile.interests,
            "common_courses": body.profile.common_courses,
            "linked_classes": body.profile.linked_classes,
            "updated_at": profile.updated_at,
        })
    }))


@router.post("/login", response_model=AuthLoginResponse)
def login(body: AuthLoginRequest, db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.account == body.account, DBUser.role == body.role).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号、角色或密码不正确")
    profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == user.id).first()
    token = create_session_token(user.id, db)
    payload = build_user_payload(user, profile)
    payload.pop("token", None)
    payload["profile"] = UserProfile(
        real_name=payload["profile"]["real_name"],
        gender=payload["profile"]["gender"],
        college=payload["profile"]["college"],
        major=payload["profile"]["major"],
        grade=payload["profile"]["grade"],
        class_name=payload["profile"]["class_name"],
        student_no=payload["profile"]["student_no"],
        teacher_no=payload["profile"]["teacher_no"],
        department=payload["profile"]["department"],
        teaching_group=payload["profile"]["teaching_group"],
        role_title=payload["profile"]["role_title"],
        birth_date=payload["profile"]["birth_date"],
        email=payload["profile"]["email"],
        phone=payload["profile"]["phone"],
        avatar_path=payload["profile"]["avatar_path"],
        bio=payload["profile"]["bio"],
        research_direction=payload["profile"]["research_direction"],
        interests=payload["profile"]["interests"],
        common_courses=json.loads(payload["profile"].get("common_courses_json", "[]")),
        linked_classes=json.loads(payload["profile"].get("linked_classes_json", "[]")),
        updated_at=payload["profile"].get("updated_at", ""),
    )
    return AuthLoginResponse(token=token, user=UserSummary(**payload))


@router.get("/me", response_model=UserSummary)
def me(current_user: dict = Depends(get_current_user)):
    profile = current_user["profile"]
    return UserSummary(
        id=current_user["id"],
        role=current_user["role"],
        account=current_user["account"],
        display_name=current_user["display_name"],
        status=current_user["status"],
        created_at=current_user["created_at"],
        profile=UserProfile(
            real_name=profile["real_name"],
            gender=profile["gender"],
            college=profile["college"],
            major=profile["major"],
            grade=profile["grade"],
            class_name=profile["class_name"],
            student_no=profile["student_no"],
            teacher_no=profile["teacher_no"],
            department=profile["department"],
            teaching_group=profile["teaching_group"],
            role_title=profile["role_title"],
            birth_date=profile["birth_date"],
            email=profile["email"],
            phone=profile["phone"],
            avatar_path=profile["avatar_path"],
            bio=profile["bio"],
            research_direction=profile["research_direction"],
            interests=profile["interests"],
            common_courses=json.loads(profile.get("common_courses_json", "[]")),
            linked_classes=json.loads(profile.get("linked_classes_json", "[]")),
            updated_at=profile.get("updated_at", ""),
        ),
    )


@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    delete_session_token(current_user["token"], db)
    return {"status": "ok"}


@router.post("/change-password")
def change_password(body: PasswordChangeRequest, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="两次输入的新密码不一致")
    user = db.query(DBUser).filter(DBUser.id == current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="当前密码不正确")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"status": "ok", "message": "密码已更新，请使用新密码重新登录。"}
