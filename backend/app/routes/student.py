"""Student-facing routes for lesson packs and question asking."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import DBLessonPack, DBQALog, DBStudent, get_db
from ..models.schemas import LessonPack, QAResponse, StudentQuestion
from ..services.llm_service import student_qa as llm_student_qa

router = APIRouter(prefix="/api/student", tags=["student"])


def _get_lp(lp_id: str, db: Session) -> DBLessonPack:
    row = db.query(DBLessonPack).filter(DBLessonPack.id == lp_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课程包不存在")
    if row.status != "published":
        raise HTTPException(status_code=403, detail="课程包尚未发布")
    return row


@router.get("/lesson-packs", response_model=List[Dict])
def list_published_packs(db: Session = Depends(get_db)):
    rows = db.query(DBLessonPack).filter(DBLessonPack.status == "published").all()
    result = []
    for lesson_pack in rows:
        payload = json.loads(lesson_pack.payload) if isinstance(lesson_pack.payload, str) else lesson_pack.payload
        result.append(
            {
                "id": lesson_pack.id,
                "course_id": lesson_pack.course_id,
                "frontier_topic": payload.get("frontier_topic", {}),
            }
        )
    return result


@router.get("/lesson-packs/{lp_id}")
def get_student_lesson_pack(lp_id: str, db: Session = Depends(get_db)):
    lesson_pack = _get_lp(lp_id, db)
    payload = json.loads(lesson_pack.payload) if isinstance(lesson_pack.payload, str) else lesson_pack.payload
    return {
        "id": lesson_pack.id,
        "frontier_topic": payload.get("frontier_topic", {}),
        "teaching_objectives": payload.get("teaching_objectives", []),
        "main_thread": payload.get("main_thread", ""),
    }


@router.post("/lesson-packs/{lp_id}/qa", response_model=QAResponse)
def student_qa(lp_id: str, body: StudentQuestion, db: Session = Depends(get_db)):
    lesson_pack_row = _get_lp(lp_id, db)
    payload = json.loads(lesson_pack_row.payload) if isinstance(lesson_pack_row.payload, str) else lesson_pack_row.payload
    lesson_pack = LessonPack(
        id=lesson_pack_row.id,
        course_id=lesson_pack_row.course_id,
        version=lesson_pack_row.version,
        status=lesson_pack_row.status,
        payload=payload,
        created_at=lesson_pack_row.created_at,
    )
    response = llm_student_qa(body.question, lesson_pack)

    student = None
    if body.student_id:
        student = db.query(DBStudent).filter(DBStudent.id == body.student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="学生信息不存在，请先注册学生")

    anonymous = bool(body.anonymous)
    db.add(
        DBQALog(
            lesson_pack_id=lp_id,
            student_id=student.id if student else "",
            student_name="匿名学生" if anonymous else (student.name if student else "未登记学生"),
            student_grade="" if anonymous or not student else student.grade,
            student_major="" if anonymous or not student else student.major,
            student_gender="" if anonymous or not student else student.gender,
            is_anonymous=1 if anonymous else 0,
            question=body.question,
            answer=response.answer,
            in_scope=1 if response.in_scope else 0,
            created_at=datetime.now().isoformat(),
        )
    )
    db.commit()
    return response
