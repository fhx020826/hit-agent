from __future__ import annotations

import os
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import (
    DBCourse,
    DBMaterial,
    MATERIAL_UPLOAD_DIR,
    get_db,
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
    MaterialUploadResponse,
    SavedAnnotationVersionItem,
)
from ..security import get_current_user, require_roles
from ..services.llm_service import extract_text_from_file
from ..services.materials_service import (
    can_access_material,
    create_annotation_item,
    create_classroom_share_item,
    create_material_request_item,
    end_live_share_item,
    get_current_live_share_item,
    list_annotation_items,
    list_current_share_items,
    list_material_request_items,
    list_saved_annotation_version_items,
    list_teacher_share_items,
    list_visible_material_items,
    live_share_manager,
    material_to_schema,
    handle_material_request_item,
    start_live_share_item,
    update_live_share_page_item,
)
from ..services.rag_service import upsert_chunks_for_material

router = APIRouter(prefix="/api/materials", tags=["materials"])


@router.post("/upload/{course_id}", response_model=MaterialUploadResponse)
def upload_material(course_id: str, file: UploadFile = File(...), current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    course = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")

    course_dir = os.path.join(MATERIAL_UPLOAD_DIR, course_id)
    os.makedirs(course_dir, exist_ok=True)
    filename = file.filename or "unknown.txt"
    file_path = os.path.join(course_dir, f"{uuid4().hex[:8]}_{filename}")
    content_bytes = file.file.read()
    with open(file_path, "wb") as output:
        output.write(content_bytes)

    ext = os.path.splitext(filename)[1].lower()
    text_content, parse_status = extract_text_from_file(file_path, ext)
    index_text = text_content if parse_status in {"parsed", "indexed"} else ""

    row = DBMaterial(
        course_id=course_id,
        filename=filename,
        content=text_content,
        file_type=ext,
        file_path=file_path,
        uploader_user_id=current_user["id"],
        file_size=len(content_bytes),
        share_scope="private",
        allow_student_view=1,
        allow_classroom_share=1,
        allow_request=1,
        class_name=course.class_name or course.audience or "",
        created_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    try:
        upsert_chunks_for_material(db, row, content_text=index_text)
        db.commit()
    except Exception:
        db.rollback()
    payload = material_to_schema(row).model_dump()
    payload["message"] = "上传成功"
    return MaterialUploadResponse(**payload)


@router.get("/{course_id}", response_model=list[MaterialItem])
def list_materials(course_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_visible_material_items(course_id, current_user, db)


@router.get("/file/{material_id}")
def download_material(material_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(DBMaterial).filter(DBMaterial.id == material_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="资料不存在")
    if not os.path.exists(row.file_path):
        raise HTTPException(status_code=404, detail="资料文件不存在")
    if not can_access_material(row, current_user, db):
        raise HTTPException(status_code=403, detail="无权访问该资料")
    return FileResponse(row.file_path, filename=row.filename)


@router.post("/share", response_model=ClassroomShare)
def create_classroom_share(body: ClassroomShareCreate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    return create_classroom_share_item(body, current_user, db)


@router.get("/shares/current", response_model=list[ClassroomShare])
def list_current_shares(course_id: str | None = None, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_current_share_items(course_id, db)


@router.get("/shares/teacher", response_model=list[ClassroomShare])
def list_teacher_shares(course_id: str | None = None, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    return list_teacher_share_items(course_id, current_user, db)


@router.post("/requests", response_model=MaterialRequestItem)
def create_material_request(body: MaterialRequestCreate, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    return create_material_request_item(body, current_user, db)


@router.get("/requests/teacher", response_model=list[MaterialRequestItem])
def list_material_requests(course_id: str | None = None, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    return list_material_request_items(course_id, db)


@router.post("/requests/{request_id}/handle", response_model=MaterialRequestItem)
def handle_request(request_id: str, status: str = Query(...), current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    return handle_material_request_item(request_id, status, current_user, db)


@router.post("/live/start", response_model=LiveShareRecord)
def start_live_share(body: LiveShareStartRequest, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    return start_live_share_item(body, current_user, db)


@router.post("/live/{share_id}/page", response_model=LiveShareRecord)
def update_live_page(share_id: str, body: LiveSharePageUpdate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    return update_live_share_page_item(share_id, body, current_user, db)


@router.post("/live/{share_id}/annotations", response_model=AnnotationStroke)
def create_annotation(share_id: str, body: AnnotationStrokeCreate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    return create_annotation_item(share_id, body, current_user, db)


@router.get("/live/current", response_model=LiveShareRecord | None)
def get_current_live_share(course_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_current_live_share_item(course_id, db)


@router.get("/live/{share_id}/annotations", response_model=list[AnnotationStroke])
def list_annotations(share_id: str, page_no: int | None = None, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_annotation_items(share_id, page_no, db)


@router.post("/live/{share_id}/end", response_model=LiveShareRecord)
def end_live_share(share_id: str, body: LiveShareCloseRequest, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    return end_live_share_item(share_id, body, current_user, db)


@router.get("/live/{share_id}/versions", response_model=list[SavedAnnotationVersionItem])
def list_saved_versions(share_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_saved_annotation_version_items(share_id, db)


@router.websocket("/live/{share_id}/ws")
async def live_share_ws(websocket: WebSocket, share_id: str):
    await live_share_manager.connect(share_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        live_share_manager.disconnect(share_id, websocket)
