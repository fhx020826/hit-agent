"""学生端路由：问答与课时包查看。"""

from __future__ import annotations

import json
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..models.schemas import StudentQuestion, QAResponse
from ..services.llm_service import student_qa as llm_student_qa
from ..database import get_db, DBLessonPack, DBQALog

router = APIRouter(prefix="/api/student", tags=["student"])


def _get_lp(lp_id: str, db: Session) -> DBLessonPack:
    row = db.query(DBLessonPack).filter(DBLessonPack.id == lp_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课时包不存在")
    if row.status != "published":
        raise HTTPException(status_code=403, detail="课时包未发布")
    return row


@router.get("/lesson-packs", response_model=List[Dict])
def list_published_packs(db: Session = Depends(get_db)):
    """学生端：获取已发布的课时包列表。"""
    rows = db.query(DBLessonPack).filter(DBLessonPack.status == "published").all()
    result = []
    for lp in rows:
        payload = json.loads(lp.payload) if isinstance(lp.payload, str) else lp.payload
        result.append({
            "id": lp.id,
            "course_id": lp.course_id,
            "frontier_topic": payload.get("frontier_topic", {}),
        })
    return result


@router.get("/lesson-packs/{lp_id}")
def get_student_lesson_pack(lp_id: str, db: Session = Depends(get_db)):
    """学生端：获取课时包摘要（不含编辑权限信息）。"""
    lp = _get_lp(lp_id, db)
    payload = json.loads(lp.payload) if isinstance(lp.payload, str) else lp.payload
    return {
        "id": lp.id,
        "frontier_topic": payload.get("frontier_topic", {}),
        "teaching_objectives": payload.get("teaching_objectives", []),
        "main_thread": payload.get("main_thread", ""),
    }


@router.post("/lesson-packs/{lp_id}/qa", response_model=QAResponse)
def student_qa(lp_id: str, body: StudentQuestion, db: Session = Depends(get_db)):
    """学生端：围绕课时包提问。"""
    lp_row = _get_lp(lp_id, db)
    payload = json.loads(lp_row.payload) if isinstance(lp_row.payload, str) else lp_row.payload
    from ..models.schemas import LessonPack
    lp = LessonPack(
        id=lp_row.id, course_id=lp_row.course_id, version=lp_row.version,
        status=lp_row.status, payload=payload, created_at=lp_row.created_at,
    )
    resp = llm_student_qa(body.question, lp)

    from datetime import datetime
    db.add(DBQALog(
        lesson_pack_id=lp_id, question=body.question,
        answer=resp.answer, in_scope=1 if resp.in_scope else 0,
        created_at=datetime.now().isoformat(),
    ))
    db.commit()
    return resp
