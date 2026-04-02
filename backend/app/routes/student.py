"""学生端路由：问答与课时包查看。"""

from fastapi import APIRouter, HTTPException

from ..models.schemas import StudentQuestion, QAResponse
from ..services.mock_data import mock_student_qa, get_demo_lesson_pack
from ..routes.lesson_packs import _lesson_packs

router = APIRouter(prefix="/api/student", tags=["student"])

# 内存存储问答日志
_qa_log: list[dict] = []


@router.get("/lesson-packs", response_model=list[dict])
def list_published_packs():
    """学生端：获取已发布的课时包列表。"""
    published = [lp for lp in _lesson_packs.values() if lp.status == "published"]
    return [
        {"id": lp.id, "course_id": lp.course_id, "frontier_topic": lp.payload.get("frontier_topic", {})}
        for lp in published
    ]


@router.get("/lesson-packs/{lp_id}")
def get_student_lesson_pack(lp_id: str):
    """学生端：获取课时包摘要（不含编辑权限信息）。"""
    if lp_id not in _lesson_packs:
        raise HTTPException(status_code=404, detail="课时包不存在")
    lp = _lesson_packs[lp_id]
    if lp.status != "published":
        raise HTTPException(status_code=403, detail="课时包未发布")
    return {
        "id": lp.id,
        "frontier_topic": lp.payload.get("frontier_topic", {}),
        "teaching_objectives": lp.payload.get("teaching_objectives", []),
        "main_thread": lp.payload.get("main_thread", ""),
    }


@router.post("/lesson-packs/{lp_id}/qa", response_model=QAResponse)
def student_qa(lp_id: str, body: StudentQuestion):
    """学生端：围绕课时包提问。"""
    if lp_id not in _lesson_packs:
        raise HTTPException(status_code=404, detail="课时包不存在")
    lp = _lesson_packs[lp_id]
    if lp.status != "published":
        raise HTTPException(status_code=403, detail="课时包未发布")
    resp = mock_student_qa(body.question, lp)
    _qa_log.append({
        "lesson_pack_id": lp_id,
        "question": body.question,
        "answer": resp.answer,
        "in_scope": resp.in_scope,
    })
    return resp
