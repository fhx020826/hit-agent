"""课时包相关路由：生成、查看、编辑、发布课时包。"""

from fastapi import APIRouter, HTTPException

from ..models.schemas import LessonPack, LessonPackUpdate
from ..services.mock_data import (
    get_demo_lesson_pack, mock_generate_lesson_pack,
    get_demo_course, DEMO_LESSON_PACK_ID,
)
from ..routes.courses import _courses

router = APIRouter(prefix="/api/lesson-packs", tags=["lesson-packs"])

# 内存存储
_lesson_packs: dict[str, LessonPack] = {DEMO_LESSON_PACK_ID: get_demo_lesson_pack()}


@router.post("/generate/{course_id}", response_model=LessonPack)
def generate_lesson_pack(course_id: str):
    """根据课程画像生成课时包。"""
    if course_id not in _courses:
        raise HTTPException(status_code=404, detail="课程不存在")
    course = _courses[course_id]
    lp = mock_generate_lesson_pack(course)
    _lesson_packs[lp.id] = lp
    return lp


@router.get("", response_model=list[LessonPack])
def list_lesson_packs(course_id: str | None = None):
    """获取课时包列表，可按课程过滤。"""
    packs = list(_lesson_packs.values())
    if course_id:
        packs = [p for p in packs if p.course_id == course_id]
    return packs


@router.get("/{lp_id}", response_model=LessonPack)
def get_lesson_pack(lp_id: str):
    """获取单个课时包。"""
    if lp_id not in _lesson_packs:
        raise HTTPException(status_code=404, detail="课时包不存在")
    return _lesson_packs[lp_id]


@router.put("/{lp_id}", response_model=LessonPack)
def update_lesson_pack(lp_id: str, body: LessonPackUpdate):
    """编辑课时包内容或状态。"""
    if lp_id not in _lesson_packs:
        raise HTTPException(status_code=404, detail="课时包不存在")
    lp = _lesson_packs[lp_id]
    if body.payload is not None:
        lp.payload = body.payload
    if body.status is not None:
        lp.status = body.status
    return lp


@router.post("/{lp_id}/publish", response_model=LessonPack)
def publish_lesson_pack(lp_id: str):
    """发布课时包到学生端。"""
    if lp_id not in _lesson_packs:
        raise HTTPException(status_code=404, detail="课时包不存在")
    _lesson_packs[lp_id].status = "published"
    return _lesson_packs[lp_id]
