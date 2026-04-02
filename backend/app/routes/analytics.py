"""分析端路由：教师复盘报告。"""

from __future__ import annotations

from typing import List, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..models.schemas import AnalyticsReport
from ..services.llm_service import analytics_from_qa_logs
from ..database import get_db, DBQALog

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/{lp_id}", response_model=AnalyticsReport)
def get_analytics(lp_id: str, db: Session = Depends(get_db)):
    """获取教师复盘报告。"""
    # 读取真实问答日志
    qa_rows = db.query(DBQALog).filter(DBQALog.lesson_pack_id == lp_id).all()
    total = len(qa_rows)

    if total == 0:
        from ..services.mock_data import mock_analytics
        return mock_analytics(lp_id)
    qa_dicts = [{"question": r.question, "answer": r.answer, "in_scope": r.in_scope} for r in qa_rows]
    return analytics_from_qa_logs(lp_id, qa_dicts)
