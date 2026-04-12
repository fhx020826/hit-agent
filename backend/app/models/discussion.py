from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field

from .materials import MaterialItem


class CourseClassItem(BaseModel):
    id: str
    course_id: str
    class_name: str
    discussion_space_id: str = ""


class DiscussionSpaceSummary(BaseModel):
    id: str
    course_id: str
    class_name: str
    space_name: str
    ai_assistant_enabled: bool = True
    member_count: int = 0
    created_at: str


class DiscussionMemberItem(BaseModel):
    user_id: str
    display_name: str
    role_in_space: str
    avatar_path: str = ""
    joined_at: str


class DiscussionAttachment(BaseModel):
    id: str
    file_name: str
    file_type: str
    file_size: int
    parse_status: str
    created_at: str
    download_url: str


class DiscussionMessageCreate(BaseModel):
    space_id: str
    content: str = ""
    is_anonymous: bool = False
    mention_ai: bool = False
    attachment_ids: List[str] = Field(default_factory=list)


class DiscussionMessageItem(BaseModel):
    id: str
    space_id: str
    sender_user_id: str
    sender_type: str
    sender_display_name: str
    sender_avatar_path: str = ""
    is_anonymous: bool = False
    message_type: str = "text"
    content: str = ""
    reply_to_message_id: str = ""
    created_at: str
    has_attachments: bool = False
    attachments: List[DiscussionAttachment] = Field(default_factory=list)
    ai_sources: List[str] = Field(default_factory=list)
    can_locate: bool = True


class DiscussionSpaceDetail(DiscussionSpaceSummary):
    course_name: str = ""
    members: List[DiscussionMemberItem] = Field(default_factory=list)
    recent_materials: List[MaterialItem] = Field(default_factory=list)


class DiscussionSearchResult(BaseModel):
    items: List[DiscussionMessageItem] = Field(default_factory=list)
    page: int = 1
    page_size: int = 20
    total: int = 0


class DiscussionContextResponse(BaseModel):
    anchor_message_id: str
    messages: List[DiscussionMessageItem] = Field(default_factory=list)
