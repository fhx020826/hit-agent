"""User registration routes for teachers and students."""

from __future__ import annotations

from datetime import datetime
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import DBStudent, DBTeacher, get_db
from ..models.schemas import Student, StudentCreate, Teacher, TeacherCreate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/teachers", response_model=List[Teacher])
def list_teachers(db: Session = Depends(get_db)):
    rows = db.query(DBTeacher).order_by(DBTeacher.created_at.desc()).all()
    return [Teacher(id=row.id, name=row.name, department=row.department, title=row.title, gender=row.gender, created_at=row.created_at) for row in rows]


@router.post("/teachers", response_model=Teacher)
def create_teacher(body: TeacherCreate, db: Session = Depends(get_db)):
    teacher = DBTeacher(
        id=f"teacher-{uuid4().hex[:8]}",
        name=body.name,
        department=body.department,
        title=body.title,
        gender=body.gender,
        created_at=datetime.now().isoformat(),
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return Teacher(id=teacher.id, name=teacher.name, department=teacher.department, title=teacher.title, gender=teacher.gender, created_at=teacher.created_at)


@router.get("/students", response_model=List[Student])
def list_students(db: Session = Depends(get_db)):
    rows = db.query(DBStudent).order_by(DBStudent.created_at.desc()).all()
    return [Student(id=row.id, name=row.name, grade=row.grade, major=row.major, gender=row.gender, created_at=row.created_at) for row in rows]


@router.post("/students", response_model=Student)
def create_student(body: StudentCreate, db: Session = Depends(get_db)):
    student = DBStudent(
        id=f"student-{uuid4().hex[:8]}",
        name=body.name,
        grade=body.grade,
        major=body.major,
        gender=body.gender,
        created_at=datetime.now().isoformat(),
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return Student(id=student.id, name=student.name, grade=student.grade, major=student.major, gender=student.gender, created_at=student.created_at)
