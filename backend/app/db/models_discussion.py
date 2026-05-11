"""讨论区相关 ORM 模型。"""

from __future__ import annotations

from sqlalchemy import Column, Index, Integer, Text
from sqlalchemy.sql.sqltypes import String

from .session import Base


class DBDiscussionSpace(Base):
    __tablename__ = "discussion_spaces"

    id = Column(String, primary_key=True)
    course_id = Column(String, nullable=False)
    offering_id = Column(String, default="")
    class_name = Column(String, default="")
    space_name = Column(String, nullable=False)
    ai_assistant_enabled = Column(Integer, default=1)
    created_at = Column(String)


class DBDiscussionSpaceMember(Base):
    __tablename__ = "discussion_space_members"

    id = Column(String, primary_key=True)
    space_id = Column(String, nullable=False)
    user_id = Column(String, default="")
    role_in_space = Column(String, default="student")
    joined_at = Column(String)


class DBDiscussionMessage(Base):
    __tablename__ = "discussion_messages"
    __table_args__ = (
        Index("idx_discussion_messages_space_id", "space_id"),
        Index("idx_discussion_messages_sender_user_id", "sender_user_id"),
        Index("idx_discussion_messages_created_at", "created_at"),
    )

    id = Column(String, primary_key=True)
    space_id = Column(String, nullable=False)
    sender_user_id = Column(String, default="")
    sender_type = Column(String, default="student")
    is_anonymous = Column(Integer, default=0)
    message_type = Column(String, default="text")
    content = Column(Text, default="")
    reply_to_message_id = Column(String, default="")
    ai_sources_json = Column(Text, default="[]")
    created_at = Column(String)


class DBDiscussionMessageAttachment(Base):
    __tablename__ = "discussion_message_attachments"

    id = Column(String, primary_key=True)
    message_id = Column(String, default="")
    uploader_user_id = Column(String, default="")
    file_name = Column(String, nullable=False)
    file_type = Column(String, default="")
    file_size = Column(Integer, default=0)
    file_path = Column(String, default="")
    parse_status = Column(String, default="pending")
    parse_summary = Column(Text, default="")
    created_at = Column(String)


class DBAIDiscussionContextLog(Base):
    __tablename__ = "ai_discussion_context_logs"

    id = Column(String, primary_key=True)
    space_id = Column(String, nullable=False)
    trigger_message_id = Column(String, nullable=False)
    used_context_range = Column(Text, default="")
    model_name = Column(String, default="")
    response_summary = Column(Text, default="")
    created_at = Column(String)
