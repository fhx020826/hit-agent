from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import DBAgentConfig, get_db
from ..models.schemas import AgentConfig, AgentConfigUpdate
from ..security import get_current_user, require_roles

router = APIRouter(prefix="/api/agent-config", tags=["agent-config"])


@router.get("/{course_id}", response_model=AgentConfig)
def get_agent_config(course_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(DBAgentConfig).filter(DBAgentConfig.course_id == course_id).first()
    if not row:
        return AgentConfig(course_id=course_id, scope_rules="仅围绕课程内容、教师上传资料和已开放的学习支持范围回答。", answer_style="讲解型", enable_homework_support=True, enable_material_qa=True, enable_frontier_extension=True, updated_at=datetime.now().isoformat())
    return AgentConfig(course_id=row.course_id, scope_rules=row.scope_rules, answer_style=row.answer_style, enable_homework_support=bool(row.enable_homework_support), enable_material_qa=bool(row.enable_material_qa), enable_frontier_extension=bool(row.enable_frontier_extension), updated_at=row.updated_at)


@router.put("/{course_id}", response_model=AgentConfig)
def update_agent_config(course_id: str, body: AgentConfigUpdate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    row = db.query(DBAgentConfig).filter(DBAgentConfig.course_id == course_id).first()
    if not row:
        row = DBAgentConfig(course_id=course_id)
        db.add(row)
    row.scope_rules = body.scope_rules
    row.answer_style = body.answer_style
    row.enable_homework_support = 1 if body.enable_homework_support else 0
    row.enable_material_qa = 1 if body.enable_material_qa else 0
    row.enable_frontier_extension = 1 if body.enable_frontier_extension else 0
    row.updated_at = datetime.now().isoformat()
    db.commit()
    db.refresh(row)
    return AgentConfig(course_id=row.course_id, scope_rules=row.scope_rules, answer_style=row.answer_style, enable_homework_support=bool(row.enable_homework_support), enable_material_qa=bool(row.enable_material_qa), enable_frontier_extension=bool(row.enable_frontier_extension), updated_at=row.updated_at)
