from __future__ import annotations

from pydantic import BaseModel


class SchoolClassItem(BaseModel):
    id: str
    name: str
    college: str
    major: str
    grade: str
    year: str
    status: str
    created_at: str
    updated_at: str


class SchoolClassCreate(BaseModel):
    name: str
    college: str = ""
    major: str = ""
    grade: str = ""
    year: str = ""
    status: str = "active"


class AcademicCourseItem(BaseModel):
    id: str
    name: str
    code: str
    description: str
    credit: str
    department: str
    status: str
    created_at: str
    updated_at: str


class AcademicCourseCreate(BaseModel):
    name: str
    code: str = ""
    description: str = ""
    credit: str = ""
    department: str = ""
    status: str = "active"


class CourseOfferingItem(BaseModel):
    id: str
    academic_course_id: str
    academic_course_name: str = ""
    course_id: str
    teacher_user_id: str
    teacher_name: str = ""
    class_id: str
    class_name: str = ""
    semester: str
    invite_code: str
    join_enabled: bool
    discussion_space_id: str
    status: str
    enrolled_count: int = 0
    created_at: str
    updated_at: str


class CourseOfferingCreate(BaseModel):
    academic_course_id: str
    teacher_user_id: str
    class_id: str
    semester: str
    course_id: str = ""
    join_enabled: bool = True


class TeacherCourseOfferingCreate(BaseModel):
    academic_course_id: str
    class_id: str
    semester: str
    course_id: str = ""
    join_enabled: bool = True


class TeacherCourseCreate(BaseModel):
    name: str
    code: str = ""
    description: str = ""
    credit: str = ""
    department: str = ""


class StudentJoinCourseRequest(BaseModel):
    code: str


class StudentSelectClassRequest(BaseModel):
    class_id: str

