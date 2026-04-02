"""分析端路由：教师复盘报告。"""

from fastapi import APIRouter, HTTPException

from ..models.schemas import AnalyticsReport
from ..services.mock_data import mock_analytics
from ..routes.student import _qa_log

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/{lp_id}", response_model=AnalyticsReport)
def get_analytics(lp_id: str):
    """获取教师复盘报告。"""
    # MVP 阶段：返回 mock 数据，后续基于真实问答日志生成
    return mock_analytics(lp_id)
