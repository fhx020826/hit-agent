"""分析端路由：教师复盘报告。"""

from __future__ import annotations

from typing import List, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..models.schemas import AnalyticsReport
from ..services.mock_data import mock_analytics
from ..database import get_db, DBQALog

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/{lp_id}", response_model=AnalyticsReport)
def get_analytics(lp_id: str, db: Session = Depends(get_db)):
    """获取教师复盘报告。"""
    # 读取真实问答日志
    qa_rows = db.query(DBQALog).filter(DBQALog.lesson_pack_id == lp_id).all()
    total = len(qa_rows)

    # MVP: 使用 mock 分析 + 真实问答计数
    report = mock_analytics(lp_id)
    report.total_questions = total if total > 0 else report.total_questions
    return report
