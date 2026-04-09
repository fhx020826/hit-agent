from __future__ import annotations

import json
import os
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import DBUser, DBUserProfile, PROFILE_UPLOAD_DIR, get_db
from ..models.schemas import AvatarUploadResponse, Student, Teacher, UserProfile, UserProfileBase
from ..security import get_current_user, require_roles

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/me", response_model=UserProfile)
def get_my_profile(current_user: dict = Depends(get_current_user)):
    profile = current_user["profile"]
    return UserProfile(
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
    )


@router.put("/me", response_model=UserProfile)
def update_my_profile(body: UserProfileBase, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(DBUserProfile).filter(DBUserProfile.user_id == current_user["id"]).first()
    if not row:
        row = DBUserProfile(user_id=current_user["id"], created_at=datetime.now().isoformat())
        db.add(row)
    row.real_name = body.real_name
    row.gender = body.gender
    row.college = body.college
    row.major = body.major
    row.grade = body.grade
    row.class_name = body.class_name
    row.student_no = body.student_no
    row.teacher_no = body.teacher_no
    row.department = body.department
    row.teaching_group = body.teaching_group
    row.role_title = body.role_title
    row.birth_date = body.birth_date
    row.email = body.email
    row.phone = body.phone
    row.avatar_path = body.avatar_path
    row.bio = body.bio
    row.research_direction = body.research_direction
    row.interests = body.interests
    row.common_courses_json = json.dumps(body.common_courses, ensure_ascii=False)
    row.linked_classes_json = json.dumps(body.linked_classes, ensure_ascii=False)
    row.updated_at = datetime.now().isoformat()

    user = db.query(DBUser).filter(DBUser.id == current_user["id"]).first()
    if user:
        user.display_name = body.real_name or user.account

    db.commit()
    return UserProfile(**body.model_dump(), updated_at=row.updated_at)


@router.post("/avatar", response_model=AvatarUploadResponse)
def upload_avatar(file: UploadFile = File(...), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=400, detail="头像仅支持 jpg、jpeg、png、webp 格式")
    payload = file.file.read()
    if len(payload) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="头像文件不能超过 5MB")

    user_dir = os.path.join(PROFILE_UPLOAD_DIR, current_user["id"])
    os.makedirs(user_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
    filename = f"avatar-{timestamp}{ext}"
    file_path = os.path.join(user_dir, filename)
    with open(file_path, "wb") as output:
        output.write(payload)

    row = db.query(DBUserProfile).filter(DBUserProfile.user_id == current_user["id"]).first()
    if not row:
        row = DBUserProfile(user_id=current_user["id"], created_at=datetime.now().isoformat())
        db.add(row)
    row.avatar_path = f"/api/profile/avatar/{current_user['id']}/{filename}"
    row.updated_at = datetime.now().isoformat()
    db.commit()
    return AvatarUploadResponse(avatar_path=row.avatar_path, updated_at=row.updated_at)


@router.get("/avatar/{user_id}/{filename}")
def get_avatar(user_id: str, filename: str):
    file_path = os.path.join(PROFILE_UPLOAD_DIR, user_id, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="头像不存在")
    return FileResponse(file_path, filename=filename)


@router.get("/students", response_model=list[Student])
def list_student_profiles(current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    users = db.query(DBUser).filter(DBUser.role == "student").all()
    profiles = {row.user_id: row for row in db.query(DBUserProfile).all()}
    return [
        Student(
            id=user.id,
            name=user.display_name,
            grade=profiles[user.id].grade if user.id in profiles else "",
            major=profiles[user.id].major if user.id in profiles else "",
            gender=profiles[user.id].gender if user.id in profiles else "",
            created_at=user.created_at,
        )
        for user in users
    ]


@router.get("/teachers", response_model=list[Teacher])
def list_teacher_profiles(current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    users = db.query(DBUser).filter(DBUser.role == "teacher").all()
    profiles = {row.user_id: row for row in db.query(DBUserProfile).all()}
    return [
        Teacher(
            id=user.id,
            name=user.display_name,
            department=profiles[user.id].department if user.id in profiles else "",
            title=profiles[user.id].role_title if user.id in profiles else "",
            gender=profiles[user.id].gender if user.id in profiles else "",
            created_at=user.created_at,
        )
        for user in users
    ]
