"""资料上传路由：教师上传课程相关文件。"""

from __future__ import annotations

import os
import json
from typing import List, Dict

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from sqlalchemy.orm import Session

from ..database import get_db, DBMaterial, DBCourse

router = APIRouter(prefix="/api/materials", tags=["materials"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload/{course_id}")
def upload_material(course_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """上传课程资料文件。"""
    # 检查课程是否存在
    course = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")

    # 保存文件
    filename = file.filename or "unknown.txt"
    file_path = os.path.join(UPLOAD_DIR, f"{course_id}_{filename}")
    content_bytes = file.file.read()

    with open(file_path, "wb") as f:
        f.write(content_bytes)

    # 提取文本内容
    text_content = ""
    ext = os.path.splitext(filename)[1].lower()
    if ext in (".txt", ".md", ".csv", ".json"):
        try:
            text_content = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text_content = content_bytes.decode("gbk")
            except UnicodeDecodeError:
                text_content = content_bytes.decode("utf-8", errors="replace")
    elif ext == ".json":
        try:
            text_content = json.dumps(json.loads(content_bytes), ensure_ascii=False, indent=2)
        except Exception:
            text_content = content_bytes.decode("utf-8", errors="replace")

    # 存入数据库
    from datetime import datetime
    row = DBMaterial(
        course_id=course_id, filename=filename,
        content=text_content, file_type=ext,
        created_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {
        "id": row.id,
        "course_id": course_id,
        "filename": filename,
        "file_type": ext,
        "size": len(content_bytes),
        "text_length": len(text_content),
        "message": "上传成功",
    }


@router.get("/{course_id}")
def list_materials(course_id: str, db: Session = Depends(get_db)):
    """获取课程的所有资料。"""
    rows = db.query(DBMaterial).filter(DBMaterial.course_id == course_id).all()
    return [
        {"id": r.id, "filename": r.filename, "file_type": r.file_type, "created_at": r.created_at}
        for r in rows
    ]
