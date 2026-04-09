"""Teacher-facing analytics routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import DBQALog, get_db
from ..models.schemas import AnalyticsReport, QuestionLogSummary
from ..services.llm_service import analytics_from_qa_logs

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/{lp_id}", response_model=AnalyticsReport)
def get_analytics(lp_id: str, db: Session = Depends(get_db)):
    qa_rows = db.query(DBQALog).filter(DBQALog.lesson_pack_id == lp_id).order_by(DBQALog.created_at.desc()).all()
    total = len(qa_rows)

    if total == 0:
        from ..services.mock_data import mock_analytics

        mock = mock_analytics(lp_id)
        return AnalyticsReport(
            lesson_pack_id=mock.lesson_pack_id,
            total_questions=0,
            anonymous_questions=0,
            identified_questions=0,
            high_freq_topics=mock.high_freq_topics,
            confused_concepts=mock.confused_concepts,
            knowledge_gaps=mock.knowledge_gaps,
            teaching_suggestions=mock.teaching_suggestions,
            recent_questions=[],
        )

    qa_dicts = [{"question": row.question, "answer": row.answer, "in_scope": row.in_scope} for row in qa_rows]
    report = analytics_from_qa_logs(lp_id, qa_dicts)
    anonymous_questions = sum(1 for row in qa_rows if int(row.is_anonymous or 0) == 1)
    identified_questions = total - anonymous_questions
    recent_questions = [
        QuestionLogSummary(
            created_at=row.created_at,
            question=row.question,
            in_scope=bool(row.in_scope),
            anonymous=bool(row.is_anonymous),
            student_display_name="匿名学生" if bool(row.is_anonymous) else (row.student_name or "未登记学生"),
            student_grade="" if bool(row.is_anonymous) else (row.student_grade or ""),
            student_major="" if bool(row.is_anonymous) else (row.student_major or ""),
        )
        for row in qa_rows[:8]
    ]

    return AnalyticsReport(
        lesson_pack_id=report.lesson_pack_id,
        total_questions=report.total_questions,
        anonymous_questions=anonymous_questions,
        identified_questions=identified_questions,
        high_freq_topics=report.high_freq_topics,
        confused_concepts=report.confused_concepts,
        knowledge_gaps=report.knowledge_gaps,
        teaching_suggestions=report.teaching_suggestions,
        recent_questions=recent_questions,
    )
