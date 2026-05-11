from __future__ import annotations

import asyncio
import json
import os
import threading
from collections import defaultdict
from datetime import datetime, timedelta
from io import BytesIO
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from fastapi import WebSocket
from sqlalchemy.orm import Session

from ..database import (
    DBClassroomShare,
    DBCourse,
    DBMaterial,
    DBMaterialAnnotation,
    DBMaterialRequest,
    DBMaterialShareRecord,
    DBSavedAnnotationVersion,
    DBTeacherNotification,
    DBUser,
    DBUserProfile,
)
from ..models.schemas import (
    AnnotationStroke,
    AnnotationStrokeCreate,
    ClassroomShare,
    ClassroomShareCreate,
    LiveShareCloseRequest,
    LiveSharePageUpdate,
    LiveShareRecord,
    LiveShareStartRequest,
    MaterialItem,
    MaterialRequestCreate,
    MaterialRequestItem,
    SavedAnnotationVersionItem,
)

try:
    from pypdf import PdfReader, PdfWriter
except Exception:
    PdfReader = None  # type: ignore[assignment]
    PdfWriter = None  # type: ignore[assignment]


class LiveShareManager:
    def __init__(self) -> None:
        self.connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, share_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[share_id].append(websocket)

    def disconnect(self, share_id: str, websocket: WebSocket) -> None:
        if share_id in self.connections and websocket in self.connections[share_id]:
            self.connections[share_id].remove(websocket)

    async def broadcast(self, share_id: str, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for connection in self.connections.get(share_id, []):
            try:
                await connection.send_json(payload)
            except Exception:
                dead.append(connection)
        for item in dead:
            self.disconnect(share_id, item)


live_share_manager = LiveShareManager()


def push_live_event(share_id: str, payload: dict[str, Any]) -> None:
    threading.Thread(target=lambda: asyncio.run(live_share_manager.broadcast(share_id, payload)), daemon=True).start()


def material_download_url(material_id: int) -> str:
    return f"/api/materials/file/{material_id}"


def _material_pdf_preview_metrics(row: DBMaterial) -> tuple[int, float | None]:
    file_type = (row.file_type or "").lower()
    filename = (row.filename or "").lower()
    if ".pdf" not in file_type and not filename.endswith(".pdf"):
        return 0, None
    if not row.file_path or not os.path.exists(row.file_path) or PdfReader is None:
        return 0, None
    try:
        reader = PdfReader(row.file_path)
        page_count = int(len(reader.pages))
        if page_count <= 0:
            return 0, None
        first_page = reader.pages[0]
        media_box = first_page.mediabox
        width = float(media_box.right) - float(media_box.left)
        height = float(media_box.top) - float(media_box.bottom)
        if width <= 0 or height <= 0:
            return page_count, None
        ratio = round(width / height, 4)
        return page_count, max(0.5, min(ratio, 2.4))
    except Exception:
        return 0, None


def material_to_schema(row: DBMaterial) -> MaterialItem:
    page_count, page_aspect_ratio = _material_pdf_preview_metrics(row)
    return MaterialItem(
        id=row.id,
        filename=row.filename,
        file_type=row.file_type,
        created_at=row.created_at,
        download_url=material_download_url(row.id),
        size=int(row.file_size or 0),
        page_count=page_count,
        page_aspect_ratio=page_aspect_ratio,
    )


def build_material_page_pdf(row: DBMaterial, page_no: int) -> bytes:
    file_type = (row.file_type or "").lower()
    filename = (row.filename or "").lower()
    if ".pdf" not in file_type and not filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF materials support page preview")
    if not row.file_path or not os.path.exists(row.file_path):
        raise HTTPException(status_code=404, detail="Material file not found")
    if PdfReader is None or PdfWriter is None:
        raise HTTPException(status_code=503, detail="PDF preview is unavailable")

    try:
        reader = PdfReader(row.file_path)
        total_pages = int(len(reader.pages))
        if page_no < 1 or page_no > total_pages:
            raise HTTPException(status_code=404, detail="Requested page is out of range")

        writer = PdfWriter()
        writer.add_page(reader.pages[page_no - 1])
        buffer = BytesIO()
        writer.write(buffer)
        return buffer.getvalue()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to build page preview") from exc


def can_access_material(row: DBMaterial, current_user: dict[str, Any], db: Session) -> bool:
    if current_user["role"] == "admin":
        return True
    if current_user["role"] == "teacher":
        return row.uploader_user_id == current_user["id"] or bool(
            db.query(DBCourse).filter(DBCourse.id == row.course_id, DBCourse.owner_user_id == current_user["id"]).first()
        )
    if current_user["role"] == "student":
        profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == current_user["id"]).first()
        return bool(row.allow_student_view) and (
            row.share_scope in {"course", "classroom"} or row.class_name in {"", profile.class_name if profile else ""}
        )
    return False


def classroom_share_to_schema(row: DBClassroomShare, db: Session) -> ClassroomShare:
    material_ids = json.loads(row.material_ids_json or "[]")
    materials: list[MaterialItem] = []
    if material_ids:
        material_rows = db.query(DBMaterial).filter(DBMaterial.id.in_(material_ids)).all()
        order = {material_id: index for index, material_id in enumerate(material_ids)}
        material_rows.sort(key=lambda item: order.get(item.id, 0))
        materials = [material_to_schema(item) for item in material_rows]
    return ClassroomShare(
        id=row.id,
        course_id=row.course_id,
        teacher_id=row.teacher_id,
        title=row.title,
        description=row.description,
        share_scope=row.share_scope,
        share_type=row.share_type,
        status=row.status,
        created_at=row.created_at,
        materials=materials,
    )


def live_share_to_schema(row: DBMaterialShareRecord, db: Session) -> LiveShareRecord:
    material = db.query(DBMaterial).filter(DBMaterial.id == row.material_id).first()
    return LiveShareRecord(
        id=row.id,
        material_id=row.material_id,
        course_id=row.course_id or (material.course_id if material else ""),
        shared_by_teacher_id=row.shared_by_teacher_id,
        share_target_type=row.share_target_type,
        share_target_id=row.share_target_id,
        is_active=bool(row.is_active),
        current_page=row.current_page or 1,
        started_at=row.started_at,
        ended_at=row.ended_at or "",
    )


def annotation_to_schema(row: DBMaterialAnnotation) -> AnnotationStroke:
    return AnnotationStroke(
        id=row.id,
        material_id=row.material_id,
        share_record_id=row.share_record_id,
        page_no=row.page_no,
        tool_type=row.tool_type,
        color=row.color,
        line_width=row.line_width,
        points_data=json.loads(row.points_data or "[]"),
        is_temporary=bool(row.is_temporary),
        created_by=row.created_by,
        created_at=row.created_at,
        expires_at=row.expires_at or "",
    )


def saved_annotation_version_to_schema(row: DBSavedAnnotationVersion) -> SavedAnnotationVersionItem:
    return SavedAnnotationVersionItem(
        id=row.id,
        material_id=row.material_id,
        share_record_id=row.share_record_id,
        saved_by=row.saved_by,
        version_name=row.version_name,
        save_mode=row.save_mode,
        created_at=row.created_at,
    )


def list_visible_material_items(course_id: str, current_user: dict[str, Any], db: Session) -> list[MaterialItem]:
    rows = db.query(DBMaterial).filter(DBMaterial.course_id == course_id).order_by(DBMaterial.created_at.desc()).all()
    visible = [row for row in rows if can_access_material(row, current_user, db)]
    return [material_to_schema(row) for row in visible]


def create_classroom_share_item(body: ClassroomShareCreate, current_user: dict[str, Any], db: Session) -> ClassroomShare:
    materials = db.query(DBMaterial).filter(DBMaterial.course_id == body.course_id, DBMaterial.id.in_(body.material_ids)).all() if body.material_ids else []
    if body.material_ids and len(materials) != len(body.material_ids):
        raise HTTPException(status_code=400, detail="存在无效的共享资料")
    row = DBClassroomShare(
        id=f"share-{uuid4().hex[:8]}",
        course_id=body.course_id,
        teacher_id=current_user["id"],
        title=body.title or "课堂资料共享",
        description=body.description,
        material_ids_json=json.dumps(body.material_ids, ensure_ascii=False),
        share_scope=body.share_scope,
        share_type=body.share_type,
        status="active",
        created_at=datetime.now().isoformat(),
    )
    db.add(row)
    for item in materials:
        item.share_scope = body.share_scope
    db.commit()
    db.refresh(row)
    return classroom_share_to_schema(row, db)


def list_current_share_items(course_id: str | None, db: Session) -> list[ClassroomShare]:
    query = db.query(DBClassroomShare).filter(DBClassroomShare.status == "active")
    if course_id:
        query = query.filter(DBClassroomShare.course_id == course_id)
    rows = query.order_by(DBClassroomShare.created_at.desc()).all()
    return [classroom_share_to_schema(row, db) for row in rows]


def list_teacher_share_items(course_id: str | None, current_user: dict[str, Any], db: Session) -> list[ClassroomShare]:
    query = db.query(DBClassroomShare).filter(DBClassroomShare.teacher_id == current_user["id"])
    if course_id:
        query = query.filter(DBClassroomShare.course_id == course_id)
    rows = query.order_by(DBClassroomShare.created_at.desc()).all()
    return [classroom_share_to_schema(row, db) for row in rows]


def create_material_request_item(body: MaterialRequestCreate, current_user: dict[str, Any], db: Session) -> MaterialRequestItem:
    now = datetime.now().isoformat()
    profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == current_user["id"]).first()
    request_row = DBMaterialRequest(
        id=f"req-{uuid4().hex[:8]}",
        course_id=body.course_id,
        class_name=profile.class_name if profile else "",
        student_id=current_user["id"],
        request_text=body.request_text or "希望教师上传或共享本节课讲义资料。",
        anonymous=0,
        status="pending",
        created_at=now,
    )
    db.add(request_row)

    teachers = db.query(DBUser).filter(DBUser.role == "teacher", DBUser.status == "active").all()
    for teacher in teachers:
        db.add(
            DBTeacherNotification(
                id=f"notify-{uuid4().hex[:8]}",
                teacher_id=teacher.id,
                message_type="material_request",
                related_question_id=request_row.id,
                title="收到学生资料请求",
                content=f"课程：{body.course_id}；学生：{current_user['display_name']}；时间：{now}；请求内容：{request_row.request_text}",
                is_read=0,
                created_at=now,
            )
        )
    db.commit()
    return MaterialRequestItem(
        id=request_row.id,
        course_id=request_row.course_id,
        student_id=request_row.student_id,
        student_name=current_user["display_name"],
        anonymous=False,
        request_text=request_row.request_text,
        status=request_row.status,
        created_at=request_row.created_at,
    )


def list_material_request_items(course_id: str | None, db: Session) -> list[MaterialRequestItem]:
    query = db.query(DBMaterialRequest)
    if course_id:
        query = query.filter(DBMaterialRequest.course_id == course_id)
    rows = query.order_by(DBMaterialRequest.created_at.desc()).all()
    students = {item.id: item for item in db.query(DBUser).filter(DBUser.role == "student").all()}
    return [
        MaterialRequestItem(
            id=row.id,
            course_id=row.course_id,
            student_id=row.student_id,
            student_name=students[row.student_id].display_name if row.student_id in students else "学生",
            anonymous=bool(row.anonymous),
            request_text=row.request_text,
            status=row.status,
            created_at=row.created_at,
        )
        for row in rows
    ]


def handle_material_request_item(request_id: str, status: str, current_user: dict[str, Any], db: Session) -> MaterialRequestItem:
    row = db.query(DBMaterialRequest).filter(DBMaterialRequest.id == request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="资料请求不存在")
    if status not in {"approved", "rejected", "shared"}:
        raise HTTPException(status_code=400, detail="不支持的处理状态")
    row.status = status
    row.handled_at = datetime.now().isoformat()
    row.handled_by = current_user["id"]
    db.commit()
    student = db.query(DBUser).filter(DBUser.id == row.student_id).first()
    return MaterialRequestItem(
        id=row.id,
        course_id=row.course_id,
        student_id=row.student_id,
        student_name=student.display_name if student else "学生",
        anonymous=bool(row.anonymous),
        request_text=row.request_text,
        status=row.status,
        created_at=row.created_at,
    )


def start_live_share_item(body: LiveShareStartRequest, current_user: dict[str, Any], db: Session) -> LiveShareRecord:
    material = db.query(DBMaterial).filter(DBMaterial.id == body.material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="资料不存在")
    share = DBMaterialShareRecord(
        id=f"live-{uuid4().hex[:8]}",
        material_id=material.id,
        course_id=material.course_id,
        shared_by_teacher_id=current_user["id"],
        share_target_type=body.share_target_type,
        share_target_id=body.share_target_id or material.class_name or material.course_id,
        is_active=1,
        current_page=1,
        started_at=datetime.now().isoformat(),
        ended_at="",
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    payload = live_share_to_schema(share, db)
    push_live_event(share.id, {"event": "share_started", "share": payload.model_dump()})
    return payload


def update_live_share_page_item(share_id: str, body: LiveSharePageUpdate, current_user: dict[str, Any], db: Session) -> LiveShareRecord:
    row = db.query(DBMaterialShareRecord).filter(DBMaterialShareRecord.id == share_id, DBMaterialShareRecord.shared_by_teacher_id == current_user["id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="共享记录不存在")
    row.current_page = body.current_page
    db.commit()
    payload = live_share_to_schema(row, db)
    push_live_event(share_id, {"event": "page_changed", "share": payload.model_dump()})
    return payload


def create_annotation_item(share_id: str, body: AnnotationStrokeCreate, current_user: dict[str, Any], db: Session) -> AnnotationStroke:
    share = db.query(DBMaterialShareRecord).filter(DBMaterialShareRecord.id == share_id, DBMaterialShareRecord.shared_by_teacher_id == current_user["id"]).first()
    if not share:
        raise HTTPException(status_code=404, detail="共享记录不存在")
    expires_at = ""
    if body.is_temporary:
        expires_at = (datetime.now() + timedelta(seconds=max(body.expires_in_seconds, 3))).isoformat()
    row = DBMaterialAnnotation(
        id=f"anno-{uuid4().hex[:8]}",
        material_id=share.material_id,
        share_record_id=share_id,
        page_no=body.page_no,
        tool_type=body.tool_type,
        color=body.color,
        line_width=body.line_width,
        points_data=json.dumps(body.points_data, ensure_ascii=False),
        is_temporary=1 if body.is_temporary else 0,
        expires_at=expires_at,
        created_by=current_user["id"],
        created_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.commit()
    payload = annotation_to_schema(row)
    push_live_event(share_id, {"event": "annotation_created", "annotation": payload.model_dump()})
    return payload


def get_current_live_share_item(course_id: str, db: Session) -> LiveShareRecord | None:
    row = (
        db.query(DBMaterialShareRecord)
        .filter(DBMaterialShareRecord.course_id == course_id, DBMaterialShareRecord.is_active == 1)
        .order_by(DBMaterialShareRecord.started_at.desc())
        .first()
    )
    if not row:
        return None
    return live_share_to_schema(row, db)


def list_annotation_items(share_id: str, page_no: int | None, db: Session) -> list[AnnotationStroke]:
    share = db.query(DBMaterialShareRecord).filter(DBMaterialShareRecord.id == share_id).first()
    if not share:
        raise HTTPException(status_code=404, detail="共享记录不存在")
    query = db.query(DBMaterialAnnotation).filter(DBMaterialAnnotation.share_record_id == share_id)
    if page_no is not None:
        query = query.filter(DBMaterialAnnotation.page_no == page_no)
    rows = query.order_by(DBMaterialAnnotation.created_at.asc()).all()
    now = datetime.now()
    visible: list[AnnotationStroke] = []
    for row in rows:
        if row.is_temporary and row.expires_at:
            try:
                if datetime.fromisoformat(row.expires_at) < now:
                    continue
            except Exception:
                pass
        visible.append(annotation_to_schema(row))
    return visible


def end_live_share_item(share_id: str, body: LiveShareCloseRequest, current_user: dict[str, Any], db: Session) -> LiveShareRecord:
    share = db.query(DBMaterialShareRecord).filter(DBMaterialShareRecord.id == share_id, DBMaterialShareRecord.shared_by_teacher_id == current_user["id"]).first()
    if not share:
        raise HTTPException(status_code=404, detail="共享记录不存在")
    share.is_active = 0
    share.ended_at = datetime.now().isoformat()

    if body.save_mode == "save":
        rows = db.query(DBMaterialAnnotation).filter(DBMaterialAnnotation.share_record_id == share_id, DBMaterialAnnotation.is_temporary == 0).all()
        version = DBSavedAnnotationVersion(
            id=f"vanno-{uuid4().hex[:8]}",
            material_id=share.material_id,
            share_record_id=share_id,
            saved_by=current_user["id"],
            version_name=body.version_name or f"课堂批注 {datetime.now().strftime('%m-%d %H:%M')}",
            save_mode="save",
            annotation_ids_json=json.dumps([item.id for item in rows], ensure_ascii=False),
            created_at=datetime.now().isoformat(),
        )
        db.add(version)
        material = db.query(DBMaterial).filter(DBMaterial.id == share.material_id).first()
        if material:
            material.has_saved_annotation = 1
    elif body.save_mode == "discard":
        db.query(DBMaterialAnnotation).filter(DBMaterialAnnotation.share_record_id == share_id).delete()

    db.commit()
    payload = live_share_to_schema(share, db)
    push_live_event(share_id, {"event": "share_ended", "share": payload.model_dump(), "save_mode": body.save_mode})
    return payload


def list_saved_annotation_version_items(share_id: str, db: Session) -> list[SavedAnnotationVersionItem]:
    rows = (
        db.query(DBSavedAnnotationVersion)
        .filter(DBSavedAnnotationVersion.share_record_id == share_id)
        .order_by(DBSavedAnnotationVersion.created_at.desc())
        .all()
    )
    return [saved_annotation_version_to_schema(row) for row in rows]
