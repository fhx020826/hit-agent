from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.schemas import (
    DiscussionAttachment,
    DiscussionContextResponse,
    DiscussionMessageCreate,
    DiscussionMessageItem,
    DiscussionSearchResult,
    DiscussionSpaceDetail,
    DiscussionSpaceSummary,
)
from ..security import get_current_user
from ..services.discussion_service import (
    create_space_messages,
    get_attachment_download_item,
    get_message_context_item,
    get_space_detail_item,
    list_accessible_spaces,
    list_member_message_items,
    list_space_messages,
    search_space_messages,
    upload_space_attachments,
)

router = APIRouter(prefix="/api/discussions", tags=["discussions"])


@router.get("/spaces", response_model=list[DiscussionSpaceSummary])
def list_spaces(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_accessible_spaces(current_user, db)


@router.get("/spaces/{space_id}", response_model=DiscussionSpaceDetail)
def get_space(space_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_space_detail_item(space_id, current_user, db)


@router.get("/spaces/{space_id}/messages", response_model=DiscussionSearchResult)
def list_messages(
    space_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_space_messages(space_id, page, page_size, current_user, db)


@router.post("/attachments", response_model=list[DiscussionAttachment])
def upload_attachments(space_id: str = Query(...), files: list[UploadFile] = File(...), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return upload_space_attachments(space_id, files, current_user, db)


@router.post("/messages", response_model=list[DiscussionMessageItem])
def send_message(body: DiscussionMessageCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return create_space_messages(body, current_user, db)


@router.get("/search", response_model=DiscussionSearchResult)
def search_messages(
    space_id: str,
    keyword: str | None = Query(default=None),
    sender_name: str | None = Query(default=None),
    sender_user_id: str | None = Query(default=None),
    sender_type: str | None = Query(default=None),
    message_type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return search_space_messages(
        space_id=space_id,
        keyword=keyword,
        sender_name=sender_name,
        sender_user_id=sender_user_id,
        sender_type=sender_type,
        message_type=message_type,
        page=page,
        page_size=page_size,
        current_user=current_user,
        db=db,
    )


@router.get("/spaces/{space_id}/members/{user_id}/messages", response_model=DiscussionSearchResult)
def list_member_messages(space_id: str, user_id: str, page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=1, le=100), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_member_message_items(space_id, user_id, page, page_size, current_user, db)


@router.get("/messages/{message_id}/context", response_model=DiscussionContextResponse)
def get_message_context(message_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_message_context_item(message_id, current_user, db)


@router.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    row = get_attachment_download_item(attachment_id, current_user, db)
    return FileResponse(row.file_path, filename=row.file_name)
