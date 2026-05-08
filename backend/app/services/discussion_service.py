from __future__ import annotations

import json
import os
from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import (
    DBCourseEnrollment,
    DBCourseOffering,
    DBAIDiscussionContextLog,
    DBAppearanceSetting,
    DBCourse,
    DBDiscussionMessage,
    DBDiscussionMessageAttachment,
    DBDiscussionSpace,
    DBDiscussionSpaceMember,
    DBMaterial,
    DBUser,
    DBUserProfile,
    DISCUSSION_UPLOAD_DIR,
)
from ..models.schemas import (
    DiscussionAttachment,
    DiscussionContextResponse,
    DiscussionMemberItem,
    DiscussionMessageCreate,
    DiscussionMessageItem,
    DiscussionSearchResult,
    DiscussionSpaceDetail,
    DiscussionSpaceSummary,
    MaterialItem,
)
from .llm_service import ask_course_assistant, extract_text_from_file

MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024


def ensure_discussion_space_for_course_class(db: Session, *, course: DBCourse, class_name: str, teacher_user_id: str) -> DBDiscussionSpace | None:
    class_name = (class_name or "").strip()
    if not class_name:
        return None

    offering = db.query(DBCourseOffering).filter(
        DBCourseOffering.course_id == course.id,
        DBCourseOffering.teacher_user_id == teacher_user_id,
        DBCourseOffering.status == "active",
    ).first()
    if offering and offering.discussion_space_id:
        space = db.query(DBDiscussionSpace).filter(DBDiscussionSpace.id == offering.discussion_space_id).first()
        if space:
            _ensure_space_members_for_offering(db, offering)
            return space

    space = DBDiscussionSpace(
        id=f"space-{uuid4().hex[:8]}",
        course_id=course.id,
        offering_id=offering.id if offering else "",
        class_name=class_name,
        space_name=f"{course.name}-{class_name}讨论空间",
        ai_assistant_enabled=1,
        created_at=datetime.now().isoformat(),
    )
    db.add(space)
    db.flush()

    if offering:
        offering.discussion_space_id = space.id
    _ensure_space_members_for_offering(db, offering) if offering else _ensure_space_members(db, space_id=space.id, class_name=class_name, teacher_user_id=teacher_user_id)
    return space


def ensure_discussion_spaces_for_all_courses(db: Session) -> None:
    courses = db.query(DBCourse).all()
    for course in courses:
        class_name = (course.class_name or course.audience or "").strip()
        if class_name and course.owner_user_id:
            ensure_discussion_space_for_course_class(db, course=course, class_name=class_name, teacher_user_id=course.owner_user_id)
    db.commit()


def ensure_member_or_admin(space_id: str, current_user: dict[str, str], db: Session) -> None:
    if current_user["role"] == "admin":
        return
    if not _space_member(space_id, current_user["id"], db):
        raise HTTPException(status_code=403, detail="当前账号不属于该讨论空间")


def attachment_download_url(attachment_id: str) -> str:
    return f"/api/discussions/attachments/{attachment_id}/download"


def attachment_to_schema(row: DBDiscussionMessageAttachment) -> DiscussionAttachment:
    return DiscussionAttachment(
        id=row.id,
        file_name=row.file_name,
        file_type=row.file_type,
        file_size=int(row.file_size or 0),
        parse_status=row.parse_status,
        created_at=row.created_at,
        download_url=attachment_download_url(row.id),
    )


def message_to_schema(row: DBDiscussionMessage, db: Session) -> DiscussionMessageItem:
    attachments = db.query(DBDiscussionMessageAttachment).filter(DBDiscussionMessageAttachment.message_id == row.id).all()
    sender_display_name, sender_avatar_path = _display_for_message(row, db)
    return DiscussionMessageItem(
        id=row.id,
        space_id=row.space_id,
        sender_user_id=row.sender_user_id,
        sender_type=row.sender_type,
        sender_display_name=sender_display_name,
        sender_avatar_path=sender_avatar_path,
        is_anonymous=bool(row.is_anonymous),
        message_type=row.message_type,
        content=row.content,
        reply_to_message_id=row.reply_to_message_id or "",
        created_at=row.created_at,
        has_attachments=len(attachments) > 0,
        attachments=[attachment_to_schema(item) for item in attachments],
        ai_sources=json.loads(row.ai_sources_json or "[]"),
        can_locate=True,
    )


def space_to_summary(row: DBDiscussionSpace, db: Session) -> DiscussionSpaceSummary:
    member_count = db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == row.id).count()
    return DiscussionSpaceSummary(
        id=row.id,
        course_id=row.course_id,
        offering_id=row.offering_id or "",
        class_name=row.class_name,
        space_name=row.space_name,
        ai_assistant_enabled=bool(row.ai_assistant_enabled),
        member_count=member_count,
        created_at=row.created_at,
    )


def list_accessible_spaces(current_user: dict[str, str], db: Session) -> list[DiscussionSpaceSummary]:
    ensure_discussion_spaces_for_all_courses(db)
    if current_user["role"] == "admin":
        rows = db.query(DBDiscussionSpace).order_by(DBDiscussionSpace.created_at.desc()).all()
        return [space_to_summary(row, db) for row in rows]

    member_rows = db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.user_id == current_user["id"]).all()
    space_ids = [row.space_id for row in member_rows]
    rows = db.query(DBDiscussionSpace).filter(DBDiscussionSpace.id.in_(space_ids)).order_by(DBDiscussionSpace.created_at.desc()).all() if space_ids else []
    return [space_to_summary(row, db) for row in rows]


def get_space_detail_item(space_id: str, current_user: dict[str, str], db: Session) -> DiscussionSpaceDetail:
    ensure_member_or_admin(space_id, current_user, db)
    row = db.query(DBDiscussionSpace).filter(DBDiscussionSpace.id == space_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="讨论空间不存在")
    course = db.query(DBCourse).filter(DBCourse.id == row.course_id).first()
    member_rows = db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == row.id).all()
    members: list[DiscussionMemberItem] = []
    for item in member_rows:
        if item.role_in_space == "ai":
            members.append(
                DiscussionMemberItem(user_id=item.user_id, display_name="AI 助教", role_in_space="ai", avatar_path="", joined_at=item.joined_at)
            )
        else:
            user = db.query(DBUser).filter(DBUser.id == item.user_id).first()
            profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == item.user_id).first()
            members.append(
                DiscussionMemberItem(
                    user_id=item.user_id,
                    display_name=user.display_name if user else "用户",
                    role_in_space=item.role_in_space,
                    avatar_path=profile.avatar_path if profile else "",
                    joined_at=item.joined_at,
                )
            )
    summary = space_to_summary(row, db).model_dump()
    summary["course_name"] = course.name if course else ""
    summary["members"] = members
    summary["recent_materials"] = _material_for_space(space_id, db)
    return DiscussionSpaceDetail(**summary)


def list_space_messages(space_id: str, page: int, page_size: int, current_user: dict[str, str], db: Session) -> DiscussionSearchResult:
    ensure_member_or_admin(space_id, current_user, db)
    query = db.query(DBDiscussionMessage).filter(DBDiscussionMessage.space_id == space_id)
    total = query.count()
    rows = query.order_by(DBDiscussionMessage.created_at.asc()).offset((page - 1) * page_size).limit(page_size).all()
    return DiscussionSearchResult(items=[message_to_schema(row, db) for row in rows], page=page, page_size=page_size, total=total)


def upload_space_attachments(space_id: str, files: list[UploadFile], current_user: dict[str, str], db: Session) -> list[DiscussionAttachment]:
    ensure_member_or_admin(space_id, current_user, db)
    user_dir = os.path.join(DISCUSSION_UPLOAD_DIR, space_id, current_user["id"])
    os.makedirs(user_dir, exist_ok=True)
    result: list[DiscussionAttachment] = []
    for file in files:
        content = file.file.read()
        if len(content) > MAX_ATTACHMENT_SIZE:
            raise HTTPException(status_code=400, detail=f"文件 {file.filename} 超过大小限制")
        ext = os.path.splitext(file.filename or "")[1].lower()
        attachment_id = f"datt-{uuid4().hex[:8]}"
        file_path = os.path.join(user_dir, f"{attachment_id}_{file.filename}")
        with open(file_path, "wb") as output:
            output.write(content)
        parse_summary, parse_status = extract_text_from_file(file_path, ext)
        row = DBDiscussionMessageAttachment(
            id=attachment_id,
            message_id="",
            uploader_user_id=current_user["id"],
            file_name=file.filename or attachment_id,
            file_type=ext,
            file_size=len(content),
            file_path=file_path,
            parse_status=parse_status,
            parse_summary=parse_summary[:12000],
            created_at=datetime.now().isoformat(),
        )
        db.add(row)
        result.append(attachment_to_schema(row))
    db.commit()
    return result


def create_space_messages(body: DiscussionMessageCreate, current_user: dict[str, str], db: Session) -> list[DiscussionMessageItem]:
    ensure_member_or_admin(body.space_id, current_user, db)
    if not body.content.strip() and not body.attachment_ids:
        raise HTTPException(status_code=400, detail="请至少输入消息内容或上传附件")

    attachments: list[DBDiscussionMessageAttachment] = []
    for attachment_id in body.attachment_ids:
        row = (
            db.query(DBDiscussionMessageAttachment)
            .filter(DBDiscussionMessageAttachment.id == attachment_id, DBDiscussionMessageAttachment.uploader_user_id == current_user["id"])
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="存在无效附件")
        attachments.append(row)

    sender_type = "teacher" if current_user["role"] == "teacher" else ("ai" if current_user["role"] == "admin" and body.content.startswith("[AI]") else "student")
    now = datetime.now().isoformat()
    msg = DBDiscussionMessage(
        id=f"dmsg-{uuid4().hex[:8]}",
        space_id=body.space_id,
        sender_user_id=current_user["id"],
        sender_type=sender_type,
        is_anonymous=1 if body.is_anonymous and sender_type == "student" else 0,
        message_type="mixed" if attachments and body.content.strip() else ("file" if attachments else "text"),
        content=body.content.strip(),
        created_at=now,
    )
    db.add(msg)
    db.flush()
    for attachment in attachments:
        attachment.message_id = msg.id

    created_items = [message_to_schema(msg, db)]
    mention_ai = body.mention_ai or ("@AI" in body.content) or ("@AI助教" in body.content)
    if mention_ai:
        space = db.query(DBDiscussionSpace).filter(DBDiscussionSpace.id == body.space_id).first()
        appearance = (
            db.query(DBAppearanceSetting)
            .filter(DBAppearanceSetting.user_role == current_user["role"], DBAppearanceSetting.user_id == current_user["id"])
            .first()
        )
        course_name, course_context = _course_context(space.course_id if space else "", db)
        ai_payload = ask_course_assistant(
            question=body.content or "请结合最近讨论和上传资料回答这个问题。",
            course_name=course_name,
            course_context=course_context,
            history=_recent_context(body.space_id, db),
            attachment_contexts=[
                {
                    "file_name": item.file_name,
                    "file_type": item.file_type,
                    "file_path": item.file_path,
                    "parse_summary": item.parse_summary,
                }
                for item in attachments
            ],
            model_key="smart",
            language=(appearance.language if appearance and appearance.language else "zh-CN"),
        )
        ai_msg = DBDiscussionMessage(
            id=f"dmsg-{uuid4().hex[:8]}",
            space_id=body.space_id,
            sender_user_id="ai-course-assistant",
            sender_type="ai",
            is_anonymous=0,
            message_type="text",
            content=ai_payload["answer"],
            reply_to_message_id=msg.id,
            ai_sources_json=json.dumps(ai_payload.get("sources", []), ensure_ascii=False),
            created_at=datetime.now().isoformat(),
        )
        db.add(ai_msg)
        db.add(
            DBAIDiscussionContextLog(
                id=f"dctx-{uuid4().hex[:8]}",
                space_id=body.space_id,
                trigger_message_id=msg.id,
                used_context_range="recent_messages:12",
                model_name=ai_payload.get("used_model_name") or ai_payload.get("used_model_key") or "smart",
                response_summary=(ai_payload["answer"] or "")[:400],
                created_at=datetime.now().isoformat(),
            )
        )
        db.flush()
        created_items.append(message_to_schema(ai_msg, db))

    db.commit()
    return created_items


def search_space_messages(
    *,
    space_id: str,
    keyword: str | None,
    sender_name: str | None,
    sender_user_id: str | None,
    sender_type: str | None,
    message_type: str | None,
    page: int,
    page_size: int,
    current_user: dict[str, str],
    db: Session,
) -> DiscussionSearchResult:
    ensure_member_or_admin(space_id, current_user, db)
    query = db.query(DBDiscussionMessage).filter(DBDiscussionMessage.space_id == space_id)
    if keyword:
        query = query.filter(DBDiscussionMessage.content.like(f"%{keyword}%"))
    if sender_user_id:
        query = query.filter(DBDiscussionMessage.sender_user_id == sender_user_id, DBDiscussionMessage.is_anonymous == 0)
    if sender_type:
        query = query.filter(DBDiscussionMessage.sender_type == sender_type)
    if message_type:
        query = query.filter(DBDiscussionMessage.message_type == message_type)
    rows = query.order_by(DBDiscussionMessage.created_at.desc()).all()
    if sender_name:
        text = sender_name.lower()
        filtered: list[DBDiscussionMessage] = []
        for row in rows:
            display_name, _ = _display_for_message(row, db)
            if row.is_anonymous and row.sender_type == "student":
                continue
            if text in display_name.lower():
                filtered.append(row)
        rows = filtered
    total = len(rows)
    paged = rows[(page - 1) * page_size : page * page_size]
    return DiscussionSearchResult(items=[message_to_schema(row, db) for row in paged], page=page, page_size=page_size, total=total)


def list_member_message_items(space_id: str, user_id: str, page: int, page_size: int, current_user: dict[str, str], db: Session) -> DiscussionSearchResult:
    ensure_member_or_admin(space_id, current_user, db)
    query = (
        db.query(DBDiscussionMessage)
        .filter(DBDiscussionMessage.space_id == space_id, DBDiscussionMessage.sender_user_id == user_id, DBDiscussionMessage.is_anonymous == 0)
        .order_by(DBDiscussionMessage.created_at.desc())
    )
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return DiscussionSearchResult(items=[message_to_schema(row, db) for row in rows], page=page, page_size=page_size, total=total)


def get_message_context_item(message_id: str, current_user: dict[str, str], db: Session) -> DiscussionContextResponse:
    message = db.query(DBDiscussionMessage).filter(DBDiscussionMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")
    ensure_member_or_admin(message.space_id, current_user, db)
    rows = (
        db.query(DBDiscussionMessage)
        .filter(DBDiscussionMessage.space_id == message.space_id, DBDiscussionMessage.created_at <= message.created_at)
        .order_by(DBDiscussionMessage.created_at.desc())
        .limit(12)
        .all()
    )
    rows.reverse()
    return DiscussionContextResponse(anchor_message_id=message_id, messages=[message_to_schema(row, db) for row in rows])


def get_attachment_download_item(attachment_id: str, current_user: dict[str, str], db: Session) -> DBDiscussionMessageAttachment:
    row = db.query(DBDiscussionMessageAttachment).filter(DBDiscussionMessageAttachment.id == attachment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="附件不存在")
    message = db.query(DBDiscussionMessage).filter(DBDiscussionMessage.id == row.message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")
    ensure_member_or_admin(message.space_id, current_user, db)
    return row


def _space_member(space_id: str, user_id: str, db: Session) -> DBDiscussionSpaceMember | None:
    return db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == space_id, DBDiscussionSpaceMember.user_id == user_id).first()


def _ensure_space_members(db: Session, *, space_id: str, class_name: str, teacher_user_id: str) -> None:
    if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == space_id, DBDiscussionSpaceMember.user_id == teacher_user_id).first():
        db.add(
            DBDiscussionSpaceMember(
                id=f"mem-{uuid4().hex[:8]}",
                space_id=space_id,
                user_id=teacher_user_id,
                role_in_space="teacher",
                joined_at=datetime.now().isoformat(),
            )
        )


def _ensure_space_members_for_offering(db: Session, offering: DBCourseOffering | None) -> None:
    if not offering or not offering.discussion_space_id:
        return
    space_id = offering.discussion_space_id
    if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == space_id, DBDiscussionSpaceMember.user_id == offering.teacher_user_id).first():
        db.add(DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space_id, user_id=offering.teacher_user_id, role_in_space="teacher", joined_at=datetime.now().isoformat()))
    enrollments = db.query(DBCourseEnrollment).filter(DBCourseEnrollment.offering_id == offering.id, DBCourseEnrollment.status == "active").all()
    for enrollment in enrollments:
        if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == space_id, DBDiscussionSpaceMember.user_id == enrollment.student_user_id).first():
            db.add(DBDiscussionSpaceMember(id=f"mem-{uuid4().hex[:8]}", space_id=space_id, user_id=enrollment.student_user_id, role_in_space="student", joined_at=datetime.now().isoformat()))
    if not db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id == space_id, DBDiscussionSpaceMember.user_id == "ai-course-assistant").first():
        db.add(
            DBDiscussionSpaceMember(
                id=f"mem-{uuid4().hex[:8]}",
                space_id=space_id,
                user_id="ai-course-assistant",
                role_in_space="ai",
                joined_at=datetime.now().isoformat(),
            )
        )


def _display_for_message(row: DBDiscussionMessage, db: Session) -> tuple[str, str]:
    if row.sender_type == "ai":
        return ("AI 助教", "")
    user = db.query(DBUser).filter(DBUser.id == row.sender_user_id).first()
    profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == row.sender_user_id).first()
    if row.is_anonymous and row.sender_type == "student":
        return ("匿名同学", "")
    return ((user.display_name if user else "用户"), (profile.avatar_path if profile and not row.is_anonymous else ""))


def _course_context(course_id: str, db: Session) -> tuple[str, str]:
    course = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    parts: list[str] = []
    if course:
        parts.append(f"课程名称：{course.name}")
        parts.append(f"授课班级：{course.class_name or course.audience}")
        parts.append(f"课程目标：{course.objectives}")
        parts.append(f"前沿方向：{course.frontier_direction}")
    materials = db.query(DBMaterial).filter(DBMaterial.course_id == course_id).order_by(DBMaterial.created_at.desc()).all()
    for item in materials[:6]:
        if item.content:
            parts.append(f"[{item.filename}] {item.content[:1500]}")
    return (course.name if course else "课程讨论", "\n".join(parts))


def _recent_context(space_id: str, db: Session, limit: int = 12) -> list[dict[str, str]]:
    rows = db.query(DBDiscussionMessage).filter(DBDiscussionMessage.space_id == space_id).order_by(DBDiscussionMessage.created_at.desc()).limit(limit).all()
    rows.reverse()
    history: list[dict[str, str]] = []
    for row in rows:
        display_name, _ = _display_for_message(row, db)
        history.append({"question": f"{display_name}: {row.content}", "answer": ""})
    return history


def _material_for_space(space_id: str, db: Session) -> list[MaterialItem]:
    space = db.query(DBDiscussionSpace).filter(DBDiscussionSpace.id == space_id).first()
    if not space:
        return []
    materials = (
        db.query(DBMaterial)
        .filter(DBMaterial.course_id == space.course_id, DBMaterial.class_name.in_(["", space.class_name]))
        .order_by(DBMaterial.created_at.desc())
        .limit(5)
        .all()
    )
    return [
        MaterialItem(
            id=item.id,
            filename=item.filename,
            file_type=item.file_type,
            created_at=item.created_at,
            download_url=f"/api/materials/file/{item.id}",
            size=int(item.file_size or 0),
        )
        for item in materials
    ]
