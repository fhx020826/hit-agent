"""课程相关路由：创建课程、获取课程列表、获取单个课程。"""

from fastapi import APIRouter, HTTPException

from ..models.schemas import Course, CourseCreate
from ..services.mock_data import get_demo_course, DEMO_COURSE_ID

router = APIRouter(prefix="/api/courses", tags=["courses"])

# 内存存储，后续替换为数据库
_courses: dict[str, Course] = {DEMO_COURSE_ID: get_demo_course()}


@router.post("", response_model=Course)
def create_course(body: CourseCreate):
    """创建课程画像。"""
    import uuid
    course = Course(id=f"course-{uuid.uuid4().hex[:8]}", **body.model_dump())
    _courses[course.id] = course
    return course


@router.get("", response_model=list[Course])
def list_courses():
    """获取所有课程。"""
    return list(_courses.values())


@router.get("/{course_id}", response_model=Course)
def get_course(course_id: str):
    """获取单个课程。"""
    if course_id not in _courses:
        raise HTTPException(status_code=404, detail="课程不存在")
    return _courses[course_id]
