from __future__ import annotations

import json
import os
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import (
    DBCourse,
    DBLearningNotebook,
    DBLearningNotebookImage,
    DBQuestion,
    DBQuestionAttachment,
    DBQuestionFolder,
    DBTeacherNotification,
    DBChatSession,
    DBWeaknessAnalysis,
    NOTEBOOK_UPLOAD_DIR,
    QUESTION_UPLOAD_DIR,
    get_db,
)
from ..models.schemas import (
    ChatSessionCreate,
    ChatSessionDetail,
    ChatSessionSummary,
    FolderContentsResponse,
    LearningNotebookCreate,
    LearningNotebookImageItem,
    LearningNotebookItem,
    LearningNotebookUpdate,
    ModelOption,
    QuestionFolderAssign,
    QuestionFolderCreate,
    QuestionFolderItem,
    QuestionFolderUpdate,
    QuestionRecord,
    StudentQuestionCreate,
    TeacherNotification,
    TeacherReplyRequest,
    UploadedAttachment,
    WeaknessAnalysisResponse,
)
from ..security import get_current_user, require_roles
from ..services.llm_service import extract_text_from_file, generate_weakness_analysis, list_available_models
from ..services.qa_service import (
    attachment_to_schema,
    build_course_context,
    build_folder_contents,
    collect_descendant_folder_ids,
    ensure_folder_access,
    ensure_folder_depth_allowed,
    folder_to_schema,
    generate_ai_answer,
    get_effective_question_folder_id,
    infer_question_input_mode,
    log_ai_answer,
    notebook_image_to_schema,
    notebook_to_schema,
    notify_teachers_for_question,
    question_to_schema,
    resolve_question_attachments,
    session_to_schema,
    teacher_course_ids,
    touch_folder_chain,
    touch_question_folder,
)

router = APIRouter(prefix="/api/qa", tags=["qa"])

MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024
TOTAL_ATTACHMENT_LIMIT = 50 * 1024 * 1024
MAX_NOTEBOOK_IMAGE_SIZE = 15 * 1024 * 1024


def _now() -> str:
    return datetime.now().isoformat()


def _normalize_sort(sort_by: str | None, sort_order: str | None) -> tuple[str, str]:
    actual_sort_by = sort_by or "updated_at"
    actual_sort_order = sort_order or "desc"
    if actual_sort_by not in {"updated_at", "created_at"}:
        raise HTTPException(status_code=400, detail="仅支持按更新时间或创建时间排序")
    if actual_sort_order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="排序方向必须为 asc 或 desc")
    return actual_sort_by, actual_sort_order


def _validate_folder_parent(*, parent_folder_id: str, user_id: str, course_id: str, db: Session) -> DBQuestionFolder | None:
    parent_id = parent_folder_id.strip()
    if not parent_id:
        return None
    parent = ensure_folder_access(parent_id, user_id, db)
    if course_id and parent.course_id and parent.course_id != course_id:
        raise HTTPException(status_code=400, detail="子文件夹必须与父文件夹属于同一课程")
    ensure_folder_depth_allowed(parent_id, db)
    return parent


def _safe_remove_file(path: str) -> None:
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


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
            created_at=_now(),
        )
        db.add(row)
        result.append(attachment_to_schema(row))
    db.commit()
    return result


@router.post("/sessions", response_model=ChatSessionSummary)
def create_session(body: ChatSessionCreate, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    now = _now()
    row = DBChatSession(
        id=f"chat-{uuid4().hex[:8]}",
        user_id=current_user["id"],
        course_id=body.course_id,
        lesson_pack_id=body.lesson_pack_id,
        title=body.title or "新建学习问答",
        selected_model=body.selected_model,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return session_to_schema(row)


@router.get("/sessions", response_model=list[ChatSessionSummary])
def list_sessions(course_id: str | None = None, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    query = db.query(DBChatSession).filter(DBChatSession.user_id == current_user["id"])
    if course_id:
        query = query.filter(DBChatSession.course_id == course_id)
    rows = query.order_by(DBChatSession.updated_at.desc()).all()
    return [session_to_schema(row) for row in rows]


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
def get_session(session_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(DBChatSession).filter(DBChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    if current_user["role"] == "student" and session.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="无权访问该会话")
    questions = db.query(DBQuestion).filter(DBQuestion.session_id == session_id).order_by(DBQuestion.created_at.asc()).all()
    payload = session_to_schema(session).model_dump()
    payload["questions"] = [question_to_schema(row, db) for row in questions]
    return ChatSessionDetail(**payload)


@router.get("/folders", response_model=list[QuestionFolderItem])
def list_question_folders(course_id: str | None = None, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    query = db.query(DBQuestionFolder).filter(DBQuestionFolder.user_id == current_user["id"])
    if course_id:
        query = query.filter(DBQuestionFolder.course_id == course_id)
    rows = query.order_by(DBQuestionFolder.updated_at.desc()).all()
    return [folder_to_schema(row, db) for row in rows]


@router.get("/folders/root/contents", response_model=FolderContentsResponse)
def get_root_folder_contents(
    course_id: str | None = None,
    sort_by: str | None = Query(default="updated_at"),
    sort_order: str | None = Query(default="desc"),
    current_user: dict = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    actual_sort_by, actual_sort_order = _normalize_sort(sort_by, sort_order)
    return build_folder_contents(
        user_id=current_user["id"],
        course_id=course_id,
        folder=None,
        sort_by=actual_sort_by,
        sort_order=actual_sort_order,
        db=db,
    )


@router.get("/folders/{folder_id}/contents", response_model=FolderContentsResponse)
def get_folder_contents(
    folder_id: str,
    sort_by: str | None = Query(default="updated_at"),
    sort_order: str | None = Query(default="desc"),
    current_user: dict = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    actual_sort_by, actual_sort_order = _normalize_sort(sort_by, sort_order)
    folder = ensure_folder_access(folder_id, current_user["id"], db)
    return build_folder_contents(
        user_id=current_user["id"],
        course_id=folder.course_id,
        folder=folder,
        sort_by=actual_sort_by,
        sort_order=actual_sort_order,
        db=db,
    )


@router.post("/folders", response_model=QuestionFolderItem)
def create_question_folder(body: QuestionFolderCreate, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="文件夹名称不能为空")
    parent = _validate_folder_parent(
        parent_folder_id=body.parent_folder_id,
        user_id=current_user["id"],
        course_id=body.course_id,
        db=db,
    )
    now = _now()
    row = DBQuestionFolder(
        id=f"qfolder-{uuid4().hex[:8]}",
        user_id=current_user["id"],
        course_id=body.course_id,
        parent_folder_id=parent.id if parent else "",
        name=body.name.strip(),
        description=body.description.strip(),
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    if parent:
        touch_folder_chain(parent.id, db, now=now)
    db.commit()
    db.refresh(row)
    return folder_to_schema(row, db)


@router.put("/folders/{folder_id}", response_model=QuestionFolderItem)
def update_question_folder(folder_id: str, body: QuestionFolderUpdate, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = ensure_folder_access(folder_id, current_user["id"], db)
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="文件夹名称不能为空")
    row.name = body.name.strip()
    row.description = body.description.strip()
    row.updated_at = _now()
    touch_folder_chain(row.parent_folder_id or "", db, now=row.updated_at)
    db.commit()
    db.refresh(row)
    return folder_to_schema(row, db)


@router.delete("/folders/{folder_id}")
def delete_question_folder(
    folder_id: str,
    cascade: bool = Query(default=False),
    current_user: dict = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    row = ensure_folder_access(folder_id, current_user["id"], db)
    target_ids = collect_descendant_folder_ids(folder_id, current_user["id"], db)

    child_folder_count = db.query(DBQuestionFolder).filter(DBQuestionFolder.user_id == current_user["id"], DBQuestionFolder.parent_folder_id.in_(target_ids)).count()
    notebook_count = db.query(DBLearningNotebook).filter(DBLearningNotebook.user_id == current_user["id"], DBLearningNotebook.parent_folder_id.in_(target_ids)).count()
    question_count = db.query(DBQuestion).filter(
        DBQuestion.user_id == current_user["id"],
        or_(DBQuestion.parent_folder_id.in_(target_ids), DBQuestion.folder_id.in_(target_ids)),
    ).count()
    total_children = child_folder_count + notebook_count + question_count

    if total_children > 0 and not cascade:
        raise HTTPException(status_code=400, detail="文件夹内仍有子文件夹、记事簿或问答记录，请确认后使用级联删除")

    now = _now()
    notebook_rows = db.query(DBLearningNotebook).filter(DBLearningNotebook.user_id == current_user["id"], DBLearningNotebook.parent_folder_id.in_(target_ids)).all()
    for notebook in notebook_rows:
        image_rows = db.query(DBLearningNotebookImage).filter(DBLearningNotebookImage.notebook_id == notebook.id).all()
        for image in image_rows:
            _safe_remove_file(image.file_path or "")
            db.delete(image)
        db.delete(notebook)

    question_rows = db.query(DBQuestion).filter(
        DBQuestion.user_id == current_user["id"],
        or_(DBQuestion.parent_folder_id.in_(target_ids), DBQuestion.folder_id.in_(target_ids)),
    ).all()
    for question in question_rows:
        attachment_rows = db.query(DBQuestionAttachment).filter(DBQuestionAttachment.question_id == question.id).all()
        for attachment in attachment_rows:
            _safe_remove_file(attachment.file_path or "")
            db.delete(attachment)
        db.query(DBTeacherNotification).filter(DBTeacherNotification.related_question_id == question.id).delete(synchronize_session=False)
        db.delete(question)

    folder_rows = db.query(DBQuestionFolder).filter(DBQuestionFolder.user_id == current_user["id"], DBQuestionFolder.id.in_(target_ids)).all()
    for folder in folder_rows:
        db.delete(folder)

    touch_folder_chain(row.parent_folder_id or "", db, now=now)
    db.commit()
    return {"status": "ok", "deleted_folder_ids": target_ids, "cascade": cascade}


@router.post("/notebooks", response_model=LearningNotebookItem)
def create_learning_notebook(body: LearningNotebookCreate, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="记事簿标题不能为空")
    parent = _validate_folder_parent(
        parent_folder_id=body.parent_folder_id,
        user_id=current_user["id"],
        course_id=body.course_id,
        db=db,
    )
    now = _now()
    row = DBLearningNotebook(
        id=f"notebook-{uuid4().hex[:8]}",
        user_id=current_user["id"],
        course_id=body.course_id,
        parent_folder_id=parent.id if parent else "",
        title=body.title.strip(),
        content_text=body.content_text,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    if parent:
        touch_folder_chain(parent.id, db, now=now)
    db.commit()
    db.refresh(row)
    return notebook_to_schema(row, db)


@router.get("/notebooks/{notebook_id}", response_model=LearningNotebookItem)
def get_learning_notebook(notebook_id: str, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = db.query(DBLearningNotebook).filter(DBLearningNotebook.id == notebook_id, DBLearningNotebook.user_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="记事簿不存在")
    return notebook_to_schema(row, db)


@router.put("/notebooks/{notebook_id}", response_model=LearningNotebookItem)
def update_learning_notebook(notebook_id: str, body: LearningNotebookUpdate, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = db.query(DBLearningNotebook).filter(DBLearningNotebook.id == notebook_id, DBLearningNotebook.user_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="记事簿不存在")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="记事簿标题不能为空")
    now = _now()
    row.title = body.title.strip()
    row.content_text = body.content_text
    row.is_starred = 1 if body.is_starred else 0
    row.updated_at = now
    touch_folder_chain(row.parent_folder_id or "", db, now=now)
    db.commit()
    db.refresh(row)
    return notebook_to_schema(row, db)


@router.delete("/notebooks/{notebook_id}")
def delete_learning_notebook(notebook_id: str, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = db.query(DBLearningNotebook).filter(DBLearningNotebook.id == notebook_id, DBLearningNotebook.user_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="记事簿不存在")
    now = _now()
    image_rows = db.query(DBLearningNotebookImage).filter(DBLearningNotebookImage.notebook_id == notebook_id).all()
    for image in image_rows:
        _safe_remove_file(image.file_path or "")
        db.delete(image)
    parent_folder_id = row.parent_folder_id or ""
    db.delete(row)
    touch_folder_chain(parent_folder_id, db, now=now)
    db.commit()
    return {"status": "ok"}


@router.post("/notebooks/{notebook_id}/images", response_model=list[LearningNotebookImageItem])
def upload_notebook_images(
    notebook_id: str,
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    notebook = db.query(DBLearningNotebook).filter(DBLearningNotebook.id == notebook_id, DBLearningNotebook.user_id == current_user["id"]).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="记事簿不存在")
    user_dir = os.path.join(NOTEBOOK_UPLOAD_DIR, current_user["id"], notebook_id)
    os.makedirs(user_dir, exist_ok=True)
    result: list[LearningNotebookImageItem] = []
    now = _now()
    for file in files:
        content = file.file.read()
        size = len(content)
        if size > MAX_NOTEBOOK_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail=f"图片 {file.filename} 超过单文件大小限制")
        ext = os.path.splitext(file.filename or "")[1].lower()
        image_id = f"noteimg-{uuid4().hex[:8]}"
        file_path = os.path.join(user_dir, f"{image_id}_{file.filename}")
        with open(file_path, "wb") as output:
            output.write(content)
        row = DBLearningNotebookImage(
            id=image_id,
            notebook_id=notebook_id,
            uploader_user_id=current_user["id"],
            file_name=file.filename or image_id,
            file_path=file_path,
            file_type=ext,
            file_size=size,
            created_at=now,
        )
        db.add(row)
        result.append(notebook_image_to_schema(row))
    notebook.updated_at = now
    touch_folder_chain(notebook.parent_folder_id or "", db, now=now)
    db.commit()
    return result


@router.delete("/notebook-images/{image_id}")
def delete_notebook_image(image_id: str, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = db.query(DBLearningNotebookImage).filter(DBLearningNotebookImage.id == image_id, DBLearningNotebookImage.uploader_user_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="记事簿图片不存在")
    notebook = db.query(DBLearningNotebook).filter(DBLearningNotebook.id == row.notebook_id, DBLearningNotebook.user_id == current_user["id"]).first()
    now = _now()
    _safe_remove_file(row.file_path or "")
    db.delete(row)
    if notebook:
        notebook.updated_at = now
        touch_folder_chain(notebook.parent_folder_id or "", db, now=now)
    db.commit()
    return {"status": "ok"}


@router.get("/notebook-images/{image_id}/download")
def download_notebook_image(image_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(DBLearningNotebookImage).filter(DBLearningNotebookImage.id == image_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="记事簿图片不存在")
    notebook = db.query(DBLearningNotebook).filter(DBLearningNotebook.id == row.notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="记事簿不存在")
    if current_user["role"] == "student" and notebook.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="无权访问该图片")
    return FileResponse(row.file_path, filename=row.file_name)


@router.post("/ask", response_model=QuestionRecord)
def ask_question(body: StudentQuestionCreate, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    if not body.question.strip() and not body.attachment_ids:
        raise HTTPException(status_code=400, detail="请至少输入问题文字或上传附件")
    session = db.query(DBChatSession).filter(DBChatSession.id == body.session_id, DBChatSession.user_id == current_user["id"]).first()
    if not session:
        raise HTTPException(status_code=404, detail="问答会话不存在")

    attachments = resolve_question_attachments(
        attachment_ids=body.attachment_ids,
        user_id=current_user["id"],
        total_attachment_limit=TOTAL_ATTACHMENT_LIMIT,
        db=db,
    )

    now = _now()
    question_id = f"q-{uuid4().hex[:8]}"
    history_rows = db.query(DBQuestion).filter(DBQuestion.session_id == body.session_id).order_by(DBQuestion.created_at.asc()).all()
    course_name, _course_context = build_course_context(body.course_id or session.course_id, body.lesson_pack_id or session.lesson_pack_id, db)

    input_mode = infer_question_input_mode(body.question, attachments)

    ai_answer_content = ""
    ai_answer_sources: list[str] = []
    ai_answer_time = ""
    status = "submitted"
    teacher_reply_status = "not_requested"

    if body.answer_target_type in {"ai", "both"}:
        ai_payload = generate_ai_answer(
            question_text=body.question,
            course_id=body.course_id or session.course_id or "",
            lesson_pack_id=body.lesson_pack_id or session.lesson_pack_id or "",
            selected_model=body.selected_model or session.selected_model or "default",
            current_user=current_user,
            history_rows=history_rows,
            attachments=attachments,
            db=db,
        )
        course_name = ai_payload["course_name"]
        ai_answer_content = ai_payload["answer"]
        ai_answer_sources = ai_payload["sources"]
        ai_answer_time = now
        body.selected_model = ai_payload["used_model_key"] or body.selected_model
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
        title=(body.question.strip()[:48] if body.question.strip() else "附件问答记录"),
        note="",
        parent_folder_id="",
        folder_id="",
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
        log_ai_answer(
            lesson_pack_id=body.lesson_pack_id or session.lesson_pack_id or "",
            current_user=current_user,
            anonymous=body.anonymous,
            question_text=body.question,
            answer_text=ai_answer_content,
            created_at=now,
            db=db,
        )

    if body.answer_target_type in {"teacher", "both"}:
        notify_teachers_for_question(
            question_id=question_id,
            course_id=body.course_id or session.course_id or "",
            course_name=course_name,
            answer_target_type=body.answer_target_type,
            anonymous=body.anonymous,
            current_user=current_user,
            created_at=now,
            db=db,
        )

    db.commit()
    db.refresh(row)
    return question_to_schema(row, db)


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
        query = query.filter(or_(DBQuestion.parent_folder_id == folder_id, DBQuestion.folder_id == folder_id))
    if collected_only:
        query = query.filter(DBQuestion.collected == 1)
    rows = query.order_by(DBQuestion.updated_at.desc()).all()
    return [question_to_schema(row, db) for row in rows]


@router.post("/questions/{question_id}/collect")
def toggle_collect(question_id: str, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = db.query(DBQuestion).filter(DBQuestion.id == question_id, DBQuestion.user_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="问题不存在")
    row.collected = 0 if int(row.collected or 0) == 1 else 1
    row.updated_at = _now()
    touch_question_folder(row, db, now=row.updated_at)
    db.commit()
    return {"status": "ok", "collected": bool(row.collected)}


@router.put("/questions/{question_id}/folder", response_model=QuestionRecord)
def assign_question_folder(question_id: str, body: QuestionFolderAssign, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = db.query(DBQuestion).filter(DBQuestion.id == question_id, DBQuestion.user_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="问题不存在")
    old_folder_id = get_effective_question_folder_id(row)
    folder_id = body.folder_id.strip()
    if folder_id:
        folder = ensure_folder_access(folder_id, current_user["id"], db)
        if folder.course_id and row.course_id and folder.course_id != row.course_id:
            raise HTTPException(status_code=400, detail="不能将问题放入其他课程的文件夹")
        row.parent_folder_id = folder.id
        row.folder_id = folder.id
    else:
        row.parent_folder_id = ""
        row.folder_id = ""
    row.updated_at = _now()
    if old_folder_id and old_folder_id != folder_id:
        touch_folder_chain(old_folder_id, db, now=row.updated_at)
    if folder_id:
        touch_folder_chain(folder_id, db, now=row.updated_at)
    db.commit()
    db.refresh(row)
    return question_to_schema(row, db)


@router.delete("/questions/{question_id}")
def delete_question(question_id: str, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    row = db.query(DBQuestion).filter(DBQuestion.id == question_id, DBQuestion.user_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="问题不存在")

    now = _now()
    attachment_rows = db.query(DBQuestionAttachment).filter(DBQuestionAttachment.question_id == question_id).all()
    for attachment in attachment_rows:
        _safe_remove_file(attachment.file_path or "")

    db.query(DBQuestionAttachment).filter(DBQuestionAttachment.question_id == question_id).delete(synchronize_session=False)
    db.query(DBTeacherNotification).filter(DBTeacherNotification.related_question_id == question_id).delete(synchronize_session=False)

    session = db.query(DBChatSession).filter(DBChatSession.id == row.session_id, DBChatSession.user_id == current_user["id"]).first()
    folder_id = get_effective_question_folder_id(row)
    db.delete(row)

    if session:
        latest = db.query(DBQuestion).filter(DBQuestion.session_id == session.id, DBQuestion.id != question_id).order_by(DBQuestion.updated_at.desc()).first()
        session.updated_at = latest.updated_at if latest else now
        if not latest:
            session.title = "新建学习问答"

    if folder_id:
        touch_folder_chain(folder_id, db, now=now)

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
    cache.updated_at = _now()
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
    teacher_course_ids_list = teacher_course_ids(current_user, db)
    if not teacher_course_ids_list:
        return []
    query = db.query(DBQuestion).filter(DBQuestion.course_id.in_(teacher_course_ids_list))
    if status:
        if status in {"pending", "replied", "closed"}:
            query = query.filter(DBQuestion.teacher_reply_status == status)
        else:
            query = query.filter(DBQuestion.status == status)
    if course_id:
        query = query.filter(DBQuestion.course_id == course_id)
    rows = query.order_by(DBQuestion.created_at.desc()).all()
    return [question_to_schema(row, db) for row in rows]


@router.post("/teacher/questions/{question_id}/reply", response_model=QuestionRecord)
def teacher_reply(question_id: str, body: TeacherReplyRequest, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    teacher_course_ids_list = teacher_course_ids(current_user, db)
    row = db.query(DBQuestion).filter(DBQuestion.id == question_id, DBQuestion.course_id.in_(teacher_course_ids_list)).first()
    if not row:
        raise HTTPException(status_code=404, detail="问题不存在")
    now = _now()
    if body.status == "pending":
        row.teacher_answer_content = ""
        row.teacher_answer_time = ""
    else:
        row.teacher_answer_content = body.reply_content
        row.teacher_answer_time = now
    row.teacher_reply_status = body.status
    row.status = "teacher_replied" if body.status == "replied" else ("closed" if body.status == "closed" else "teacher_pending")
    row.updated_at = now
    touch_question_folder(row, db, now=now)
    db.commit()
    db.refresh(row)
    return question_to_schema(row, db)


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
