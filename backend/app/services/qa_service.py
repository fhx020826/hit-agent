from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..database import (
    DBAppearanceSetting,
    DBChatSession,
    DBCourse,
    DBLessonPack,
    DBMaterial,
    DBQuestion,
    DBQuestionAttachment,
    DBQuestionFolder,
    DBQALog,
    DBTeacherNotification,
    DBUser,
    DBUserProfile,
)
from ..models.schemas import ChatSessionSummary, QuestionFolderItem, QuestionRecord, UploadedAttachment
from .llm_service import ask_course_assistant
from .rag_service import ensure_course_chunk_index, retrieve_relevant_chunks


def attachment_download_url(attachment_id: str) -> str:
    return f"/api/qa/attachments/{attachment_id}/download"


def attachment_to_schema(row: DBQuestionAttachment) -> UploadedAttachment:
    return UploadedAttachment(
        id=row.id,
        file_name=row.file_name,
        file_type=row.file_type,
        file_size=row.file_size,
        parse_status=row.parse_status,
        parse_summary=row.parse_summary,
        created_at=row.created_at,
        download_url=attachment_download_url(row.id),
    )


def question_to_schema(row: DBQuestion, db: Session) -> QuestionRecord:
    attachments = db.query(DBQuestionAttachment).filter(DBQuestionAttachment.question_id == row.id).all()
    user = db.query(DBUser).filter(DBUser.id == row.user_id).first()
    profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == row.user_id).first()
    folder = db.query(DBQuestionFolder).filter(DBQuestionFolder.id == (row.folder_id or "")).first() if row.folder_id else None
    teacher_answer_content = row.teacher_answer_content or ""
    teacher_answer_time = row.teacher_answer_time or ""
    if row.teacher_reply_status == "pending":
        teacher_answer_content = ""
        teacher_answer_time = ""
    return QuestionRecord(
        id=row.id,
        session_id=row.session_id,
        course_id=row.course_id,
        lesson_pack_id=row.lesson_pack_id,
        question_text=row.question_text,
        answer_target_type=row.answer_target_type,
        selected_model=row.selected_model,
        anonymous=bool(row.is_anonymous),
        status=row.status,
        teacher_reply_status=row.teacher_reply_status,
        ai_answer_content=row.ai_answer_content,
        ai_answer_time=row.ai_answer_time,
        ai_answer_sources=json.loads(row.ai_answer_sources or "[]"),
        teacher_answer_content=teacher_answer_content,
        teacher_answer_time=teacher_answer_time,
        has_attachments=bool(row.has_attachments),
        attachment_count=row.attachment_count,
        input_mode=row.input_mode,
        collected=bool(row.collected),
        folder_id=row.folder_id or "",
        folder_name=folder.name if folder else "",
        created_at=row.created_at,
        updated_at=row.updated_at,
        attachment_items=[attachment_to_schema(item) for item in attachments],
        asker_display_name="匿名学生" if bool(row.is_anonymous) else (user.display_name if user else "未知用户"),
        asker_class_name="" if bool(row.is_anonymous) else (profile.class_name if profile else ""),
    )


def session_to_schema(row: DBChatSession) -> ChatSessionSummary:
    return ChatSessionSummary(
        id=row.id,
        course_id=row.course_id,
        lesson_pack_id=row.lesson_pack_id,
        title=row.title,
        selected_model=row.selected_model,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def folder_to_schema(row: DBQuestionFolder, db: Session) -> QuestionFolderItem:
    count = db.query(DBQuestion).filter(DBQuestion.user_id == row.user_id, DBQuestion.folder_id == row.id).count()
    return QuestionFolderItem(
        id=row.id,
        course_id=row.course_id,
        name=row.name,
        description=row.description or "",
        question_count=count,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def build_course_context(course_id: str, lesson_pack_id: str, db: Session) -> tuple[str, str]:
    parts = []
    course = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if course:
        parts.append(f"课程名称：{course.name}")
        parts.append(f"授课对象：{course.audience}")
        parts.append(f"课程目标：{course.objectives}")
        parts.append(f"前沿方向：{course.frontier_direction}")
    lesson_pack = None
    if lesson_pack_id:
        lesson_pack = db.query(DBLessonPack).filter(DBLessonPack.id == lesson_pack_id).first()
    if not lesson_pack and course_id:
        lesson_pack = (
            db.query(DBLessonPack)
            .filter(DBLessonPack.course_id == course_id, DBLessonPack.status == "published")
            .order_by(DBLessonPack.created_at.desc())
            .first()
        )
    if lesson_pack:
        payload = json.loads(lesson_pack.payload) if isinstance(lesson_pack.payload, str) else lesson_pack.payload
        parts.append("课程包内容：" + json.dumps(payload, ensure_ascii=False))
    materials = db.query(DBMaterial).filter(DBMaterial.course_id == course_id).all() if course_id else []
    if materials:
        parts.append("教学资料摘要：")
        for item in materials[:8]:
            if item.content:
                parts.append(f"[{item.filename}] {item.content[:2000]}")
            else:
                parts.append(f"[{item.filename}] 当前仅保存文件，暂无可解析文本。")
    return (course.name if course else "未命名课程", "\n".join(parts))


def teacher_course_ids(current_user: dict[str, Any], db: Session) -> list[str]:
    owned_rows = db.query(DBCourse).filter(DBCourse.owner_user_id == current_user["id"]).all()
    profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == current_user["id"]).first()
    common_courses = set(json.loads(profile.common_courses_json or "[]")) if profile and profile.common_courses_json else set()
    all_rows = db.query(DBCourse).all() if common_courses else []
    seen: set[str] = set()
    result: list[str] = []
    for row in owned_rows + [item for item in all_rows if item.name in common_courses]:
        if row.id in seen:
            continue
        seen.add(row.id)
        result.append(row.id)
    return result


def resolve_question_attachments(*, attachment_ids: list[str], user_id: str, total_attachment_limit: int, db: Session) -> list[DBQuestionAttachment]:
    attachments: list[DBQuestionAttachment] = []
    total_attachment_size = 0
    for attachment_id in attachment_ids:
        row = db.query(DBQuestionAttachment).filter(DBQuestionAttachment.id == attachment_id, DBQuestionAttachment.uploader_user_id == user_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="存在无效附件")
        total_attachment_size += int(row.file_size or 0)
        attachments.append(row)
    if total_attachment_size > total_attachment_limit:
        raise HTTPException(status_code=400, detail="附件总大小超过限制")
    return attachments


def infer_question_input_mode(question_text: str, attachments: list[DBQuestionAttachment]) -> str:
    if attachments and question_text.strip():
        return "mixed"
    if attachments:
        first_type = attachments[0].file_type.lower()
        if first_type in {".jpg", ".jpeg", ".png", ".webp"}:
            return "image"
        if first_type in {".zip", ".rar"}:
            return "archive"
        return "document"
    return "text"


def generate_ai_answer(
    *,
    question_text: str,
    course_id: str,
    lesson_pack_id: str,
    selected_model: str,
    current_user: dict[str, Any],
    history_rows: list[DBQuestion],
    attachments: list[DBQuestionAttachment],
    db: Session,
) -> dict[str, Any]:
    appearance = (
        db.query(DBAppearanceSetting)
        .filter(DBAppearanceSetting.user_role == current_user["role"], DBAppearanceSetting.user_id == current_user["id"])
        .first()
    )
    rag_query_parts: list[str] = []
    if question_text.strip():
        rag_query_parts.append(question_text.strip())
    attachment_summaries = [f"{item.file_name}: {item.parse_summary}" for item in attachments if (item.parse_summary or "").strip()]
    if attachment_summaries:
        rag_query_parts.append("\n".join(attachment_summaries[:4]))
    rag_query_text = "\n".join(rag_query_parts).strip() or "课程核心概念"

    retrieved_chunks: list[dict[str, Any]] = []
    try:
        created_chunk_count = ensure_course_chunk_index(db, course_id or "")
        if created_chunk_count > 0:
            db.commit()
        retrieved_chunks = retrieve_relevant_chunks(
            db,
            course_id=course_id or "",
            query_text=rag_query_text,
            top_k=6,
        )
    except Exception:
        retrieved_chunks = []

    course_name, course_context = build_course_context(course_id, lesson_pack_id, db)
    history = [{"question": row.question_text, "answer": row.ai_answer_content or row.teacher_answer_content} for row in history_rows]
    ai_payload = ask_course_assistant(
        question=question_text or "请结合上传附件帮我理解这份资料。",
        course_name=course_name,
        course_context=course_context,
        history=history,
        attachment_contexts=[
            {
                "file_name": item.file_name,
                "file_type": item.file_type,
                "file_path": item.file_path,
                "parse_summary": item.parse_summary,
            }
            for item in attachments
        ],
        retrieved_chunks=retrieved_chunks,
        model_key=selected_model or "default",
        language=(appearance.language if appearance and appearance.language else "zh-CN"),
    )
    return {
        "course_name": course_name,
        "answer": ai_payload["answer"],
        "sources": ai_payload["sources"],
        "used_model_key": ai_payload.get("used_model_key") or selected_model,
    }


def log_ai_answer(
    *,
    lesson_pack_id: str,
    current_user: dict[str, Any],
    anonymous: bool,
    question_text: str,
    answer_text: str,
    created_at: str,
    db: Session,
) -> None:
    profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == current_user["id"]).first()
    db.add(
        DBQALog(
            lesson_pack_id=lesson_pack_id or "",
            student_id=current_user["id"],
            student_name="匿名学生" if anonymous else current_user["display_name"],
            student_grade="" if anonymous or not profile else profile.grade,
            student_major="" if anonymous or not profile else profile.major,
            student_gender="" if anonymous or not profile else profile.gender,
            is_anonymous=1 if anonymous else 0,
            question=question_text or "附件问答",
            answer=answer_text,
            in_scope=1,
            created_at=created_at,
        )
    )


def notify_teachers_for_question(
    *,
    question_id: str,
    course_id: str,
    course_name: str,
    answer_target_type: str,
    anonymous: bool,
    current_user: dict[str, Any],
    created_at: str,
    db: Session,
) -> None:
    course = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    teachers = []
    if course and course.owner_user_id:
        owner = db.query(DBUser).filter(DBUser.id == course.owner_user_id, DBUser.role == "teacher", DBUser.status == "active").first()
        if owner:
            teachers = [owner]
    if not teachers:
        teachers = db.query(DBUser).filter(DBUser.role == "teacher", DBUser.status == "active").all()
    student_profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == current_user["id"]).first()
    for teacher in teachers:
        db.add(
            DBTeacherNotification(
                id=f"notify-{uuid4().hex[:8]}",
                teacher_id=teacher.id,
                message_type="question",
                related_question_id=question_id,
                title="收到新的学生提问",
                content=f"课程：{course_name}；时间：{created_at}；身份：{'匿名学生' if anonymous else current_user['display_name']}；是否已由 AI 回答：{'是' if answer_target_type in {'ai', 'both'} else '否'}；班级：{'' if anonymous or not student_profile else student_profile.class_name}",
                is_read=0,
                created_at=created_at,
            )
        )
