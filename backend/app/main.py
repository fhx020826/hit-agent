"""FastAPI application entrypoint."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routes import admin, agent_config, analytics, assignment_review, assignments, auth, courses, discussion, feedback, lesson_packs, material_update, materials, profile, qa, settings, student, task_jobs, users
from .services.task_jobs import TaskJobService

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时完成数据库初始化，避免使用已弃用的 startup 事件装饰器。
    init_db()
    task_job_service = getattr(app.state, "task_jobs", None)
    if task_job_service is None:
        task_job_service = TaskJobService()
        app.state.task_jobs = task_job_service
    task_job_service.start()
    try:
        yield
    finally:
        task_job_service.shutdown()


app = FastAPI(
    title="面向前沿学科的智能教学平台",
    version="0.8.0",
    description="面向前沿学科教学场景的教师教学全流程智能伙伴平台。",
    lifespan=lifespan,
)

frontend_port = os.getenv("FRONTEND_PORT", "3000")
extra_origins = [o.strip() for o in os.getenv("EXTRA_CORS_ORIGINS", "").split(",") if o.strip()]
frontend_origin_regex = os.getenv(
    "FRONTEND_ORIGIN_REGEX",
    rf"^https?://(localhost|127\.0\.0\.1|10(?:\.\d{{1,3}}){{3}}|192\.168(?:\.\d{{1,3}}){{2}}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{{1,3}}){{2}})(:{frontend_port})?$",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"] + extra_origins,
    allow_origin_regex=frontend_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(settings.router)
app.include_router(courses.router)
app.include_router(discussion.router)
app.include_router(lesson_packs.router)
app.include_router(materials.router)
app.include_router(agent_config.router)
app.include_router(qa.router)
app.include_router(assignments.router)
app.include_router(material_update.router)
app.include_router(task_jobs.router)
app.include_router(feedback.router)
app.include_router(analytics.router)
app.include_router(student.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(assignment_review.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.8.0"}
