from __future__ import annotations

import asyncio
import threading
from collections import defaultdict
from typing import Any

from fastapi import WebSocket
from sqlalchemy.orm import Session

from ..database import DBCourse, DBMaterial, DBUserProfile


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
