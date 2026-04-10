from __future__ import annotations

import json
import os
import shutil
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import (
    DBAppearanceSetting,
    DBCourse,
    DBLessonPack,
    DBMaterial,
    DBQuestion,
    DBQuestionAttachment,
    DBQuestionFolder,
    DBQALog,
    DBTeacherNotification,
    DBChatSession,
    DBUser,
    DBUserProfile,
    DBWeaknessAnalysis,
    QUESTION_UPLOAD_DIR,
    get_db,
)
from ..models.schemas import (
    ChatSessionCreate,
    ChatSessionDetail,
    ChatSessionSummary,
    MaterialUpdateResult,
    ModelOption,
    QuestionRecord,
    QuestionFolderAssign,
    QuestionFolderCreate,
    QuestionFolderItem,
    QuestionFolderUpdate,
    StudentQuestionCreate,
    TeacherNotification,
    TeacherReplyRequest,
    UploadedAttachment,
    WeaknessAnalysisResponse,
)
from ..security import get_current_user, require_roles
from ..services.llm_service import ask_course_assistant, extract_text_from_file, generate_weakness_analysis, list_available_models
from ..services.rag_service import ensure_course_chunk_index, retrieve_relevant_chunks

router = APIRouter(prefix="/api/qa", tags=["qa"])

MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024
TOTAL_ATTACHMENT_LIMIT = 50 * 1024 * 1024


def _attachment_download_url(attachment_id: str) -> str:
    return f"/api/qa/attachments/{attachment_id}/download"


def _attachment_to_schema(row: DBQuestionAttachment) -> UploadedAttachment:
    return UploadedAttachment(
        id=row.id,
        file_name=row.file_name,
        file_type=row.file_type,
        file_size=row.file_size,
        parse_status=row.parse_status,
        parse_summary=row.parse_summary,
        created_at=row.created_at,
        download_url=_attachment_download_url(row.id),
    )


def _question_to_schema(row: DBQuestion, db: Session) -> QuestionRecord:
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
        attachment_items=[_attachment_to_schema(item) for item in attachments],
        asker_display_name="匿名学生" if bool(row.is_anonymous) else (user.display_name if user else "未知用户"),
        asker_class_name="" if bool(row.is_anonymous) else (profile.class_name if profile else ""),
    )


def _session_to_schema(row: DBChatSession) -> ChatSessionSummary:
    return ChatSessionSummary(
        id=row.id,
        course_id=row.course_id,
        lesson_pack_id=row.lesson_pack_id,
        title=row.title,
        selected_model=row.selected_model,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _folder_to_schema(row: DBQuestionFolder, db: Session) -> QuestionFolderItem:
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


def _build_course_context(course_id: str, lesson_pack_id: str, db: Session) -> tuple[str, str]:
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
        lesson_pack = db.query(DBLessonPack).filter(DBLessonPack.course_id == course_id, DBLessonPack.status == "published").order_by(DBLessonPack.created_at.desc()).first()
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


def _teacher_course_ids(current_user: dict, db: Session) -> list[str]:
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


@router.get("/models", response_model=list[ModelOption])
def get_models(current_user: dict = Depends(get_current_user)):
    return list_available_models()


@router.post("/attachments", response_model=list[UploadedAttachment])
def upload_question_attachments(files: list[UploadFile] = File(...), current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    total = 0
    result: list[UploadedAttachment] = []
    user_dir = os.path.join(QUESTION_UPLOAD_DIR, current_user["id"])
    os.makedirs(user_dir, exist_ok=True)

    for file in files:
        content = file.file.read()
        size = len(content)
        total += size
        if size > MAX_ATTACHMENT_SIZE:
            raise HTTPException(status_code=400, detail=f"文件 {file.filename} 超过单文件大小限制")
        if total > TOTAL_ATTACHMENT_LIMIT:
            raise HTTPException(status_code=400, detail="本次提问附件总大小超过限制")
        ext = os.path.splitext(file.filename or "")[1].lower()
        attachment_id = f"att-{uuid4().hex[:8]}"
        file_path = os.path.join(user_dir, f"{attachment_id}_{file.filename}")
        with open(file_path, "wb") as output:
            output.write(content)
        parse_summary, parse_status = extract_text_from_file(file_path, ext)
        row = DBQuestionAttachment(
            id=attachment_id,
            question_id="",
            uploader_user_id=current_user["id"],
            file_name=file.filename or attachment_id,
            file_type=ext,
            file_size=size,
            file_path=file_path,
            parse_status=parse_status,
            parse_summary=parse_summary[:12000],
            created_at=datetime.now().isoformat(),
        )
        db.add(row)
        result.append(_attachment_to_schema(row))
    db.commit()
    return result


@router.post("/sessions", response_model=ChatSessionSummary)
def create_session(body: ChatSessionCreate, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = DBChatSession(
        id=f"chat-{uuid4().hex[:8]}",
        user_id=current_user["id"],
        course_id=body.course_id,
        lesson_pack_id=body.lesson_pack_id,
        title=body.title or "新建学习问答",
        selected_model=body.selected_model,
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _session_to_schema(row)


@router.get("/sessions", response_model=list[ChatSessionSummary])
def list_sessions(course_id: str | None = None, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    query = db.query(DBChatSession).filter(DBChatSession.user_id == current_user["id"])
    if course_id:
        query = query.filter(DBChatSession.course_id == course_id)
    rows = query.order_by(DBChatSession.updated_at.desc()).all()
    return [_session_to_schema(row) for row in rows]


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
def get_session(session_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(DBChatSession).filter(DBChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    if current_user["role"] == "student" and session.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="无权访问该会话")
    questions = db.query(DBQuestion).filter(DBQuestion.session_id == session_id).order_by(DBQuestion.created_at.asc()).all()
    payload = _session_to_schema(session).model_dump()
    payload["questions"] = [_question_to_schema(row, db) for row in questions]
    return ChatSessionDetail(**payload)


@router.get("/folders", response_model=list[QuestionFolderItem])
def list_question_folders(course_id: str | None = None, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    query = db.query(DBQuestionFolder).filter(DBQuestionFolder.user_id == current_user["id"])
    if course_id:
        query = query.filter(DBQuestionFolder.course_id == course_id)
    rows = query.order_by(DBQuestionFolder.updated_at.desc()).all()
    return [_folder_to_schema(row, db) for row in rows]


@router.post("/folders", response_model=QuestionFolderItem)
def create_question_folder(body: QuestionFolderCreate, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="文件夹名称不能为空")
    row = DBQuestionFolder(
        id=f"qfolder-{uuid4().hex[:8]}",
        user_id=current_user["id"],
        course_id=body.course_id,
        name=body.name.strip(),
        description=body.description.strip(),
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _folder_to_schema(row, db)


@router.put("/folders/{folder_id}", response_model=QuestionFolderItem)
def update_question_folder(folder_id: str, body: QuestionFolderUpdate, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = db.query(DBQuestionFolder).filter(DBQuestionFolder.id == folder_id, DBQuestionFolder.user_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="文件夹名称不能为空")
    row.name = body.name.strip()
    row.description = body.description.strip()
    row.updated_at = datetime.now().isoformat()
    db.commit()
    db.refresh(row)
    return _folder_to_schema(row, db)


@router.delete("/folders/{folder_id}")
def delete_question_folder(folder_id: str, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = db.query(DBQuestionFolder).filter(DBQuestionFolder.id == folder_id, DBQuestionFolder.user_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    db.query(DBQuestion).filter(DBQuestion.user_id == current_user["id"], DBQuestion.folder_id == folder_id).update(
        {"folder_id": "", "updated_at": datetime.now().isoformat()},
        synchronize_session=False,
    )
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.post("/ask", response_model=QuestionRecord)
def ask_question(body: StudentQuestionCreate, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    if not body.question.strip() and not body.attachment_ids:
        raise HTTPException(status_code=400, detail="请至少输入问题文字或上传附件")
    session = db.query(DBChatSession).filter(DBChatSession.id == body.session_id, DBChatSession.user_id == current_user["id"]).first()
    if not session:
        raise HTTPException(status_code=404, detail="问答会话不存在")

    attachments = []
    total_attachment_size = 0
    for attachment_id in body.attachment_ids:
        row = db.query(DBQuestionAttachment).filter(DBQuestionAttachment.id == attachment_id, DBQuestionAttachment.uploader_user_id == current_user["id"]).first()
        if not row:
            raise HTTPException(status_code=404, detail="存在无效附件")
        total_attachment_size += int(row.file_size or 0)
        attachments.append(row)
    if total_attachment_size > TOTAL_ATTACHMENT_LIMIT:
        raise HTTPException(status_code=400, detail="附件总大小超过限制")

    now = datetime.now().isoformat()
    question_id = f"q-{uuid4().hex[:8]}"
    history_rows = db.query(DBQuestion).filter(DBQuestion.session_id == body.session_id).order_by(DBQuestion.created_at.asc()).all()
    course_name, course_context = _build_course_context(body.course_id or session.course_id, body.lesson_pack_id or session.lesson_pack_id, db)
    history = [{"question": row.question_text, "answer": row.ai_answer_content or row.teacher_answer_content} for row in history_rows]

    input_mode = "text"
    if attachments and body.question.strip():
        input_mode = "mixed"
    elif attachments:
        first_type = attachments[0].file_type.lower()
        input_mode = "image" if first_type in {".jpg", ".jpeg", ".png", ".webp"} else ("archive" if first_type in {".zip", ".rar"} else "document")

    ai_answer_content = ""
    ai_answer_sources: list[str] = []
    ai_answer_time = ""
    status = "submitted"
    teacher_reply_status = "not_requested"

    if body.answer_target_type in {"ai", "both"}:
        appearance = db.query(DBAppearanceSetting).filter(DBAppearanceSetting.user_role == current_user["role"], DBAppearanceSetting.user_id == current_user["id"]).first()
        rag_query_parts: list[str] = []
        if body.question.strip():
            rag_query_parts.append(body.question.strip())
        attachment_summaries = [f"{item.file_name}: {item.parse_summary}" for item in attachments if (item.parse_summary or "").strip()]
        if attachment_summaries:
            rag_query_parts.append("\n".join(attachment_summaries[:4]))
        rag_query_text = "\n".join(rag_query_parts).strip() or "课程核心概念"
        retrieved_chunks: list[dict] = []
        try:
            created_chunk_count = ensure_course_chunk_index(db, body.course_id or session.course_id or "")
            if created_chunk_count > 0:
                db.commit()
            retrieved_chunks = retrieve_relevant_chunks(
                db,
                course_id=(body.course_id or session.course_id or ""),
                query_text=rag_query_text,
                top_k=6,
            )
        except Exception:
            retrieved_chunks = []
        ai_payload = ask_course_assistant(
            question=body.question or "请结合上传附件帮我理解这份资料。",
            course_name=course_name,
            course_context=course_context,
            history=history,
            attachment_contexts=[{"file_name": item.file_name, "file_type": item.file_type, "file_path": item.file_path, "parse_summary": item.parse_summary} for item in attachments],
            retrieved_chunks=retrieved_chunks,
            model_key=body.selected_model or session.selected_model or "default",
            language=(appearance.language if appearance and appearance.language else "zh-CN"),
        )
        ai_answer_content = ai_payload["answer"]
        ai_answer_sources = ai_payload["sources"]
        ai_answer_time = now
        body.selected_model = ai_payload.get("used_model_key") or body.selected_model
        status = "ai_answered" if body.answer_target_type == "ai" else "teacher_pending"

    if body.answer_target_type in {"teacher", "both"}:
        teacher_reply_status = "pending"
        if status == "submitted":
            status = "teacher_pending"

    row = DBQuestion(
        id=question_id,
        session_id=body.session_id,
        user_id=current_user["id"],
        course_id=body.course_id or session.course_id,
        lesson_pack_id=body.lesson_pack_id or session.lesson_pack_id,
        question_text=body.question.strip(),
        answer_target_type=body.answer_target_type,
        selected_model=body.selected_model or session.selected_model or "default",
        is_anonymous=1 if body.anonymous else 0,
        status=status,
        teacher_reply_status=teacher_reply_status,
        ai_answer_content=ai_answer_content,
        ai_answer_time=ai_answer_time,
        ai_answer_sources=json.dumps(ai_answer_sources, ensure_ascii=False),
        teacher_answer_content="",
        teacher_answer_time="",
        has_attachments=1 if attachments else 0,
        attachment_count=len(attachments),
        input_mode=input_mode,
        created_at=now,
        updated_at=now,
    )
    db.add(row)

    for attachment in attachments:
        attachment.question_id = question_id

    session.updated_at = now
    if not history_rows:
        session.title = body.question[:18] if body.question else f"附件问答 {datetime.now().strftime('%m-%d %H:%M')}"
    session.selected_model = body.selected_model or session.selected_model

    if ai_answer_content:
        profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == current_user["id"]).first()
        db.add(DBQALog(
            lesson_pack_id=body.lesson_pack_id or session.lesson_pack_id or "",
            student_id=current_user["id"],
            student_name="匿名学生" if body.anonymous else current_user["display_name"],
            student_grade="" if body.anonymous or not profile else profile.grade,
            student_major="" if body.anonymous or not profile else profile.major,
            student_gender="" if body.anonymous or not profile else profile.gender,
            is_anonymous=1 if body.anonymous else 0,
            question=body.question or "附件问答",
            answer=ai_answer_content,
            in_scope=1,
            created_at=now,
        ))

    if body.answer_target_type in {"teacher", "both"}:
        course = db.query(DBCourse).filter(DBCourse.id == (body.course_id or session.course_id)).first()
        teachers = []
        if course and course.owner_user_id:
            owner = db.query(DBUser).filter(DBUser.id == course.owner_user_id, DBUser.role == "teacher", DBUser.status == "active").first()
            if owner:
                teachers = [owner]
        if not teachers:
            teachers = db.query(DBUser).filter(DBUser.role == "teacher", DBUser.status == "active").all()
        student_profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == current_user["id"]).first()
        for teacher in teachers:
            db.add(DBTeacherNotification(
                id=f"notify-{uuid4().hex[:8]}",
                teacher_id=teacher.id,
                message_type="question",
                related_question_id=question_id,
                title="收到新的学生提问",
                content=f"课程：{course_name}；时间：{now}；身份：{'匿名学生' if body.anonymous else current_user['display_name']}；是否已由 AI 回答：{'是' if body.answer_target_type in {'ai','both'} else '否'}；班级：{'' if body.anonymous or not student_profile else student_profile.class_name}",
                is_read=0,
                created_at=now,
            ))

    db.commit()
    db.refresh(row)
    return _question_to_schema(row, db)


@router.get("/history", response_model=list[QuestionRecord])
def list_question_history(
    course_id: str | None = None,
    folder_id: str | None = None,
    collected_only: bool = Query(default=False),
    current_user: dict = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    query = db.query(DBQuestion).filter(DBQuestion.user_id == current_user["id"])
    if course_id:
        query = query.filter(DBQuestion.course_id == course_id)
    if folder_id:
        query = query.filter(DBQuestion.folder_id == folder_id)
    if collected_only:
        query = query.filter(DBQuestion.collected == 1)
    rows = query.order_by(DBQuestion.updated_at.desc()).all()
    return [_question_to_schema(row, db) for row in rows]


@router.post("/questions/{question_id}/collect")
def toggle_collect(question_id: str, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = db.query(DBQuestion).filter(DBQuestion.id == question_id, DBQuestion.user_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="问题不存在")
    row.collected = 0 if int(row.collected or 0) == 1 else 1
    row.updated_at = datetime.now().isoformat()
    db.commit()
    return {"status": "ok", "collected": bool(row.collected)}


@router.put("/questions/{question_id}/folder", response_model=QuestionRecord)
def assign_question_folder(question_id: str, body: QuestionFolderAssign, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = db.query(DBQuestion).filter(DBQuestion.id == question_id, DBQuestion.user_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="问题不存在")
    folder_id = body.folder_id.strip()
    if folder_id:
        folder = db.query(DBQuestionFolder).filter(DBQuestionFolder.id == folder_id, DBQuestionFolder.user_id == current_user["id"]).first()
        if not folder:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        if folder.course_id and row.course_id and folder.course_id != row.course_id:
            raise HTTPException(status_code=400, detail="不能将问题放入其他课程的文件夹")
        row.folder_id = folder.id
    else:
        row.folder_id = ""
    row.updated_at = datetime.now().isoformat()
    db.commit()
    db.refresh(row)
    return _question_to_schema(row, db)


@router.delete("/questions/{question_id}")
def delete_question(question_id: str, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = db.query(DBQuestion).filter(DBQuestion.id == question_id, DBQuestion.user_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="问题不存在")

    attachment_rows = db.query(DBQuestionAttachment).filter(DBQuestionAttachment.question_id == question_id).all()
    for attachment in attachment_rows:
        if attachment.file_path and os.path.exists(attachment.file_path):
            try:
                os.remove(attachment.file_path)
            except OSError:
                pass

    db.query(DBQuestionAttachment).filter(DBQuestionAttachment.question_id == question_id).delete(synchronize_session=False)
    db.query(DBTeacherNotification).filter(DBTeacherNotification.related_question_id == question_id).delete(synchronize_session=False)

    session = db.query(DBChatSession).filter(DBChatSession.id == row.session_id, DBChatSession.user_id == current_user["id"]).first()
    db.delete(row)

    if session:
        latest = db.query(DBQuestion).filter(DBQuestion.session_id == session.id, DBQuestion.id != question_id).order_by(DBQuestion.updated_at.desc()).first()
        now = datetime.now().isoformat()
        session.updated_at = latest.updated_at if latest else now
        if not latest:
            session.title = "新建学习问答"

    db.commit()
    return {"status": "ok"}


@router.get("/weakness-analysis", response_model=WeaknessAnalysisResponse)
def get_weakness_analysis(course_id: str | None = None, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    query = db.query(DBQuestion).filter(DBQuestion.user_id == current_user["id"])
    if course_id:
        query = query.filter(DBQuestion.course_id == course_id)
    rows = query.order_by(DBQuestion.created_at.desc()).all()
    course = db.query(DBCourse).filter(DBCourse.id == course_id).first() if course_id else None
    diagnosis = generate_weakness_analysis([row.question_text for row in rows if row.question_text], course_name=(course.name if course else ""))
    cache = db.query(DBWeaknessAnalysis).filter(DBWeaknessAnalysis.user_id == current_user["id"], DBWeaknessAnalysis.course_id == (course_id or "")).first()
    if not cache:
        cache = DBWeaknessAnalysis(id=f"weak-{uuid4().hex[:8]}", user_id=current_user["id"], course_id=course_id or "")
        db.add(cache)
    cache.summary = diagnosis["summary"]
    cache.weak_points_json = json.dumps(diagnosis["weak_points"], ensure_ascii=False)
    cache.suggestions_json = json.dumps(diagnosis["suggestions"], ensure_ascii=False)
    cache.updated_at = datetime.now().isoformat()
    db.commit()
    return WeaknessAnalysisResponse(
        course_id=course_id or "",
        course_name=course.name if course else ("全部课程" if not course_id else ""),
        total_questions=len(rows),
        summary=cache.summary,
        weak_points=json.loads(cache.weak_points_json or "[]"),
        suggestions=json.loads(cache.suggestions_json or "[]"),
        updated_at=cache.updated_at,
    )


@router.get("/teacher/questions", response_model=list[QuestionRecord])
def list_teacher_questions(
    status: str | None = Query(default=None),
    course_id: str | None = Query(default=None),
    current_user: dict = Depends(require_roles("teacher")),
    db: Session = Depends(get_db),
):
    teacher_course_ids = _teacher_course_ids(current_user, db)
    if not teacher_course_ids:
        return []
    query = db.query(DBQuestion).filter(DBQuestion.course_id.in_(teacher_course_ids))
    if status:
        if status in {"pending", "replied", "closed"}:
            query = query.filter(DBQuestion.teacher_reply_status == status)
        else:
            query = query.filter(DBQuestion.status == status)
    if course_id:
        query = query.filter(DBQuestion.course_id == course_id)
    rows = query.order_by(DBQuestion.created_at.desc()).all()
    return [_question_to_schema(row, db) for row in rows]


@router.post("/teacher/questions/{question_id}/reply", response_model=QuestionRecord)
def teacher_reply(question_id: str, body: TeacherReplyRequest, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    teacher_course_ids = _teacher_course_ids(current_user, db)
    row = db.query(DBQuestion).filter(DBQuestion.id == question_id, DBQuestion.course_id.in_(teacher_course_ids)).first()
    if not row:
        raise HTTPException(status_code=404, detail="问题不存在")
    now = datetime.now().isoformat()
    if body.status == "pending":
        row.teacher_answer_content = ""
        row.teacher_answer_time = ""
    else:
        row.teacher_answer_content = body.reply_content
        row.teacher_answer_time = now
    row.teacher_reply_status = body.status
    row.status = "teacher_replied" if body.status == "replied" else ("closed" if body.status == "closed" else "teacher_pending")
    row.updated_at = now
    db.commit()
    db.refresh(row)
    return _question_to_schema(row, db)


@router.get("/teacher/notifications", response_model=list[TeacherNotification])
def list_notifications(current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    rows = db.query(DBTeacherNotification).filter(DBTeacherNotification.teacher_id == current_user["id"]).order_by(DBTeacherNotification.created_at.desc()).all()
    return [TeacherNotification(id=row.id, message_type=row.message_type, related_question_id=row.related_question_id, title=row.title, content=row.content, is_read=bool(row.is_read), created_at=row.created_at) for row in rows]


@router.post("/teacher/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    is_read: bool = Query(default=True),
    current_user: dict = Depends(require_roles("teacher")),
    db: Session = Depends(get_db),
):
    row = db.query(DBTeacherNotification).filter(DBTeacherNotification.id == notification_id, DBTeacherNotification.teacher_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="通知不存在")
    row.is_read = 1 if is_read else 0
    db.commit()
    return {"status": "ok", "is_read": bool(row.is_read)}


@router.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(DBQuestionAttachment).filter(DBQuestionAttachment.id == attachment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="附件不存在")
    question = db.query(DBQuestion).filter(DBQuestion.id == row.question_id).first() if row.question_id else None
    allowed = row.uploader_user_id == current_user["id"]
    if current_user["role"] == "teacher" and question:
        allowed = True
    if not allowed:
        raise HTTPException(status_code=403, detail="无权访问该附件")
    return FileResponse(row.file_path, filename=row.file_name)
