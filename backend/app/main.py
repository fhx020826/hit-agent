"""FastAPI 应用入口。"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routes import courses, lesson_packs, student, analytics, materials

# 设置代理（如果本地有代理服务）
if not os.getenv("https_proxy") and not os.getenv("HTTPS_PROXY"):
    os.environ["http_proxy"] = "http://127.0.0.1:7897"
    os.environ["https_proxy"] = "http://127.0.0.1:7897"

app = FastAPI(
    title="前沿融课教师助手",
    version="0.2.0",
    description="面向高校教师的前沿知识快速入课智能体 MVP",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


app.include_router(courses.router)
app.include_router(lesson_packs.router)
app.include_router(student.router)
app.include_router(analytics.router)
app.include_router(materials.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.2.0"}
