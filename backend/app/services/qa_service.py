from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..database import (
    DBAppearanceSetting,
    DBChatSession,
    DBCourse,
    DBLearningNotebook,
    DBLearningNotebookImage,
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
from ..models.schemas import (
    ChatSessionSummary,
    FolderContentsResponse,
    LearningDirectoryItem,
    LearningNotebookImageItem,
    LearningNotebookItem,
    QuestionFolderBreadcrumb,
    QuestionFolderItem,
    QuestionRecord,
    UploadedAttachment,
)
from .llm_service import ask_course_assistant
from .rag_service import ensure_course_chunk_index, retrieve_relevant_chunks

MAX_FOLDER_DEPTH = 5


def attachment_download_url(attachment_id: str) -> str:
    return f"/api/qa/attachments/{attachment_id}/download"


def notebook_image_download_url(image_id: str) -> str:
    return f"/api/qa/notebook-images/{image_id}/download"


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


def notebook_image_to_schema(row: DBLearningNotebookImage) -> LearningNotebookImageItem:
    return LearningNotebookImageItem(
        id=row.id,
        notebook_id=row.notebook_id,
        file_name=row.file_name,
        file_type=row.file_type,
        file_size=row.file_size,
        created_at=row.created_at,
        download_url=notebook_image_download_url(row.id),
    )


def get_effective_question_folder_id(row: DBQuestion) -> str:
    return (row.parent_folder_id or row.folder_id or "").strip()


def get_folder_depth(folder_id: str, db: Session) -> int:
    if not folder_id:
        return 0
    depth = 0
    current_id = folder_id
    visited: set[str] = set()
    while current_id:
        if current_id in visited:
            raise HTTPException(status_code=400, detail="文件夹层级存在循环引用")
        visited.add(current_id)
        folder = db.query(DBQuestionFolder).filter(DBQuestionFolder.id == current_id).first()
        if not folder:
            break
        depth += 1
        current_id = (folder.parent_folder_id or "").strip()
    return depth


def ensure_folder_access(folder_id: str, user_id: str, db: Session) -> DBQuestionFolder:
    row = db.query(DBQuestionFolder).filter(DBQuestionFolder.id == folder_id, DBQuestionFolder.user_id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    return row


def ensure_folder_depth_allowed(parent_folder_id: str, db: Session) -> int:
    depth = get_folder_depth(parent_folder_id, db)
    if depth >= MAX_FOLDER_DEPTH:
        raise HTTPException(status_code=400, detail=f"文件夹最多支持 {MAX_FOLDER_DEPTH} 级")
    return depth


def build_folder_breadcrumbs(folder: DBQuestionFolder | None, db: Session) -> list[QuestionFolderBreadcrumb]:
    if not folder:
        return []
    rows: list[QuestionFolderBreadcrumb] = []
    current = folder
    visited: set[str] = set()
    while current:
        if current.id in visited:
            break
        visited.add(current.id)
        rows.append(QuestionFolderBreadcrumb(id=current.id, name=current.name))
        parent_id = (current.parent_folder_id or "").strip()
        if not parent_id:
            break
        current = db.query(DBQuestionFolder).filter(DBQuestionFolder.id == parent_id).first()
    return list(reversed(rows))


def collect_descendant_folder_ids(folder_id: str, user_id: str, db: Session) -> list[str]:
    descendants: list[str] = []
    queue = [folder_id]
    while queue:
        current_id = queue.pop(0)
        descendants.append(current_id)
        child_ids = [
            row.id
            for row in db.query(DBQuestionFolder.id)
            .filter(DBQuestionFolder.user_id == user_id, DBQuestionFolder.parent_folder_id == current_id)
            .all()
        ]
        queue.extend(child_ids)
    return descendants


def touch_folder_chain(folder_id: str, db: Session, now: str | None = None) -> None:
    current_id = (folder_id or "").strip()
    timestamp = now or datetime.now().isoformat()
    visited: set[str] = set()
    while current_id:
        if current_id in visited:
            break
        visited.add(current_id)
        folder = db.query(DBQuestionFolder).filter(DBQuestionFolder.id == current_id).first()
        if not folder:
            break
        folder.updated_at = timestamp
        current_id = (folder.parent_folder_id or "").strip()


def touch_question_folder(row: DBQuestion, db: Session, now: str | None = None) -> None:
    folder_id = get_effective_question_folder_id(row)
    if folder_id:
        touch_folder_chain(folder_id, db, now=now)


def notebook_to_schema(row: DBLearningNotebook, db: Session, include_images: bool = True) -> LearningNotebookItem:
    image_rows = (
        db.query(DBLearningNotebookImage)
        .filter(DBLearningNotebookImage.notebook_id == row.id)
        .order_by(DBLearningNotebookImage.created_at.asc())
        .all()
    )
    return LearningNotebookItem(
        id=row.id,
        course_id=row.course_id,
        parent_folder_id=row.parent_folder_id or "",
        title=row.title,
        content_text=row.content_text or "",
        is_starred=bool(row.is_starred),
        image_count=len(image_rows),
        created_at=row.created_at,
        updated_at=row.updated_at,
        images=[notebook_image_to_schema(item) for item in image_rows] if include_images else [],
    )


def question_to_schema(row: DBQuestion, db: Session) -> QuestionRecord:
    attachments = db.query(DBQuestionAttachment).filter(DBQuestionAttachment.question_id == row.id).all()
    user = db.query(DBUser).filter(DBUser.id == row.user_id).first()
    profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == row.user_id).first()
    folder_id = get_effective_question_folder_id(row)
    folder = db.query(DBQuestionFolder).filter(DBQuestionFolder.id == folder_id).first() if folder_id else None
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
        folder_id=folder_id,
        folder_name=folder.name if folder else "",
        title=row.title or "",
        note=row.note or "",
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
    folder_id = row.id
    question_count = (
        db.query(DBQuestion)
        .filter(DBQuestion.user_id == row.user_id, (DBQuestion.parent_folder_id == folder_id) | (DBQuestion.folder_id == folder_id))
        .count()
    )
    notebook_count = db.query(DBLearningNotebook).filter(DBLearningNotebook.user_id == row.user_id, DBLearningNotebook.parent_folder_id == folder_id).count()
    child_folder_count = db.query(DBQuestionFolder).filter(DBQuestionFolder.user_id == row.user_id, DBQuestionFolder.parent_folder_id == folder_id).count()
    return QuestionFolderItem(
        id=row.id,
        course_id=row.course_id,
        parent_folder_id=row.parent_folder_id or "",
        name=row.name,
        description=row.description or "",
        depth=get_folder_depth(row.id, db),
        question_count=question_count,
        notebook_count=notebook_count,
        child_folder_count=child_folder_count,
        total_item_count=question_count + notebook_count + child_folder_count,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def build_directory_item_for_folder(row: DBQuestionFolder, db: Session) -> LearningDirectoryItem:
    schema = folder_to_schema(row, db)
    return LearningDirectoryItem(
        id=row.id,
        item_type="folder",
        course_id=row.course_id,
        parent_folder_id=row.parent_folder_id or "",
        name=row.name,
        summary=row.description or "",
        updated_at=row.updated_at,
        created_at=row.created_at,
        folder=schema,
    )


def build_directory_item_for_notebook(row: DBLearningNotebook, db: Session) -> LearningDirectoryItem:
    schema = notebook_to_schema(row, db, include_images=False)
    return LearningDirectoryItem(
        id=row.id,
        item_type="notebook",
        course_id=row.course_id,
        parent_folder_id=row.parent_folder_id or "",
        name=row.title,
        summary=(row.content_text or "")[:160],
        updated_at=row.updated_at,
        created_at=row.created_at,
        notebook=schema,
    )


def build_directory_item_for_question(row: DBQuestion, db: Session) -> LearningDirectoryItem:
    schema = question_to_schema(row, db)
    return LearningDirectoryItem(
        id=row.id,
        item_type="question",
        course_id=row.course_id,
        parent_folder_id=get_effective_question_folder_id(row),
        name=row.title or row.question_text[:48] or "学习问答记录",
        summary=row.note or row.question_text[:160],
        updated_at=row.updated_at,
        created_at=row.created_at,
        question=schema,
    )


def sort_directory_items(items: list[LearningDirectoryItem], *, sort_by: str, sort_order: str) -> list[LearningDirectoryItem]:
    reverse = sort_order != "asc"

    def key_fn(item: LearningDirectoryItem) -> tuple[str, str, str]:
        primary = item.updated_at if sort_by == "updated_at" else item.created_at
        return (primary or "", item.name or "", item.id)

    return sorted(items, key=key_fn, reverse=reverse)


def build_folder_contents(
    *,
    user_id: str,
    course_id: str | None,
    folder: DBQuestionFolder | None,
    sort_by: str = "updated_at",
    sort_order: str = "desc",
    db: Session,
) -> FolderContentsResponse:
    parent_folder_id = folder.id if folder else ""
    effective_course_id = course_id if course_id is not None else (folder.course_id if folder else "")

    folders_query = db.query(DBQuestionFolder).filter(
        DBQuestionFolder.user_id == user_id,
        DBQuestionFolder.parent_folder_id == parent_folder_id,
    )
    notebooks_query = db.query(DBLearningNotebook).filter(
        DBLearningNotebook.user_id == user_id,
        DBLearningNotebook.parent_folder_id == parent_folder_id,
    )
    questions_query = db.query(DBQuestion).filter(
        DBQuestion.user_id == user_id,
        ((DBQuestion.parent_folder_id == parent_folder_id) | ((DBQuestion.parent_folder_id == "") & (DBQuestion.folder_id == parent_folder_id))),
    )

    if effective_course_id:
        folders_query = folders_query.filter(DBQuestionFolder.course_id == effective_course_id)
        notebooks_query = notebooks_query.filter(DBLearningNotebook.course_id == effective_course_id)
        questions_query = questions_query.filter(DBQuestion.course_id == effective_course_id)

    items: list[LearningDirectoryItem] = []
    items.extend(build_directory_item_for_folder(item, db) for item in folders_query.all())
    items.extend(build_directory_item_for_notebook(item, db) for item in notebooks_query.all())
    items.extend(build_directory_item_for_question(item, db) for item in questions_query.all())

    return FolderContentsResponse(
        folder=folder_to_schema(folder, db) if folder else None,
        breadcrumbs=build_folder_breadcrumbs(folder, db),
        items=sort_directory_items(items, sort_by=sort_by, sort_order=sort_order),
        sort_by=sort_by,
        sort_order=sort_order,
        current_depth=get_folder_depth(folder.id, db) if folder else 0,
        max_depth=MAX_FOLDER_DEPTH,
    )


def build_course_context(course_id: str, lesson_pack_id: str, db: Session) -> tuple[str, str]:
    parts: list[str] = []
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
                id=f"notify-{datetime.now().strftime('%H%M%S')}-{teacher.id[-4:]}",
                teacher_id=teacher.id,
                message_type="question",
                related_question_id=question_id,
                title="收到新的学生提问",
                content=f"课程：{course_name}；时间：{created_at}；身份：{'匿名学生' if anonymous else current_user['display_name']}；是否已有 AI 回答：{'是' if answer_target_type in {'ai', 'both'} else '否'}；班级：{'' if anonymous or not student_profile else student_profile.class_name}",
                is_read=0,
                created_at=created_at,
            )
        )
