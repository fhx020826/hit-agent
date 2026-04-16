from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import DBUser, DBUserProfile, DBSurveyInstance, DBSurveyResponse, DBSurveyTemplate, get_db
from ..models.schemas import SurveyAnalytics, SurveyInstance, SurveyInstanceCreate, SurveyPendingItem, SurveySubmit, SurveyTemplate
from ..security import require_roles
from ..services.course_membership import ensure_student_course_access, ensure_teacher_course_access, list_course_members

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


def _survey_instance_to_schema(row: DBSurveyInstance) -> SurveyInstance:
    return SurveyInstance(
        id=row.id,
        lesson_pack_id=row.lesson_pack_id,
        course_id=row.course_id,
        template_id=row.template_id,
        title=row.title,
        status=row.status,
        trigger_mode=row.trigger_mode,
        created_at=row.created_at,
    )


@router.get("/templates", response_model=list[SurveyTemplate])
def list_templates(current_user: dict = Depends(require_roles("teacher", "student")), db: Session = Depends(get_db)):
    rows = db.query(DBSurveyTemplate).all()
    return [SurveyTemplate(id=row.id, name=row.name, description=row.description, questions=json.loads(row.questions_json), created_at=row.created_at) for row in rows]


@router.post("/instances", response_model=SurveyInstance)
def create_survey_instance(body: SurveyInstanceCreate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    ensure_teacher_course_access(body.course_id, current_user, db)
    template = db.query(DBSurveyTemplate).filter(DBSurveyTemplate.id == body.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="问卷模板不存在")
    row = DBSurveyInstance(id=f"survey-{uuid4().hex[:8]}", lesson_pack_id=body.lesson_pack_id, course_id=body.course_id, template_id=body.template_id, title=body.title, status="open", trigger_mode=body.trigger_mode, created_at=datetime.now().isoformat())
    db.add(row)
    db.commit()
    db.refresh(row)
    return _survey_instance_to_schema(row)


@router.get("/instances", response_model=list[SurveyInstance])
def list_survey_instances(
    course_id: str | None = Query(default=None),
    lesson_pack_id: str | None = Query(default=None),
    current_user: dict = Depends(require_roles("teacher")),
    db: Session = Depends(get_db),
):
    if course_id:
        ensure_teacher_course_access(course_id, current_user, db)
    query = db.query(DBSurveyInstance)
    if course_id:
        query = query.filter(DBSurveyInstance.course_id == course_id)
    if lesson_pack_id:
        query = query.filter(DBSurveyInstance.lesson_pack_id == lesson_pack_id)
    rows = query.order_by(DBSurveyInstance.created_at.desc()).all()
    return [_survey_instance_to_schema(row) for row in rows]


@router.get("/pending", response_model=list[SurveyPendingItem])
def list_pending_surveys(current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    responses = db.query(DBSurveyResponse).filter(DBSurveyResponse.student_id == current_user["id"]).all()
    handled = {response.survey_instance_id for response in responses if int(response.submitted or 0) == 1 or int(response.skipped or 0) == 1}
    instances = db.query(DBSurveyInstance).filter(DBSurveyInstance.status == "open").all()
    items = []
    for instance in instances:
        if instance.id in handled:
            continue
        try:
            ensure_student_course_access(instance.course_id, current_user, db)
        except HTTPException:
            continue
        template = db.query(DBSurveyTemplate).filter(DBSurveyTemplate.id == instance.template_id).first()
        items.append(SurveyPendingItem(id=instance.id, lesson_pack_id=instance.lesson_pack_id, course_id=instance.course_id, title=instance.title, questions=json.loads(template.questions_json) if template else [], created_at=instance.created_at))
    return items


@router.post("/instances/{survey_instance_id}/submit")
def submit_survey(survey_instance_id: str, body: SurveySubmit, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    instance = db.query(DBSurveyInstance).filter(DBSurveyInstance.id == survey_instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="问卷不存在")
    ensure_student_course_access(instance.course_id, current_user, db)
    response = db.query(DBSurveyResponse).filter(DBSurveyResponse.survey_instance_id == survey_instance_id, DBSurveyResponse.student_id == current_user["id"]).first()
    if not response:
        response = DBSurveyResponse(survey_instance_id=survey_instance_id, student_id=current_user["id"])
        db.add(response)
    response.submitted = 1
    response.skipped = 0
    response.answers_json = json.dumps(body.answers, ensure_ascii=False)
    response.created_at = datetime.now().isoformat()
    db.commit()
    return {"status": "ok"}


@router.post("/instances/{survey_instance_id}/skip")
def skip_survey(survey_instance_id: str, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    instance = db.query(DBSurveyInstance).filter(DBSurveyInstance.id == survey_instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="问卷不存在")
    ensure_student_course_access(instance.course_id, current_user, db)
    response = db.query(DBSurveyResponse).filter(DBSurveyResponse.survey_instance_id == survey_instance_id, DBSurveyResponse.student_id == current_user["id"]).first()
    if not response:
        response = DBSurveyResponse(survey_instance_id=survey_instance_id, student_id=current_user["id"])
        db.add(response)
    response.submitted = 0
    response.skipped = 1
    response.answers_json = "{}"
    response.created_at = datetime.now().isoformat()
    db.commit()
    return {"status": "ok"}


@router.get("/analytics/{survey_instance_id}", response_model=SurveyAnalytics)
def get_survey_analytics(survey_instance_id: str, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    instance = db.query(DBSurveyInstance).filter(DBSurveyInstance.id == survey_instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="问卷不存在")
    ensure_teacher_course_access(instance.course_id, current_user, db)
    template = db.query(DBSurveyTemplate).filter(DBSurveyTemplate.id == instance.template_id).first()
    questions = json.loads(template.questions_json) if template else []
    students = list_course_members(db, instance.course_id, role="student")
    responses = db.query(DBSurveyResponse).filter(DBSurveyResponse.survey_instance_id == survey_instance_id, DBSurveyResponse.submitted == 1).all()
    rating_breakdown = defaultdict(Counter)
    choice_breakdown = defaultdict(Counter)
    text_feedback = []
    for response in responses:
        answers = json.loads(response.answers_json or "{}")
        for question in questions:
            qid = question.get("id")
            if qid not in answers:
                continue
            value = answers[qid]
            if question.get("type") == "rating":
                rating_breakdown[qid][str(value)] += 1
            elif question.get("type") == "choice":
                choice_breakdown[qid][str(value)] += 1
            elif question.get("type") == "text" and str(value).strip():
                text_feedback.append(str(value).strip())
    participation_count = len(responses)
    total_target_students = len(students)
    participation_rate = round((participation_count / total_target_students) * 100, 2) if total_target_students else 0.0
    return SurveyAnalytics(survey_instance_id=instance.id, title=instance.title, total_target_students=total_target_students, participation_count=participation_count, participation_rate=participation_rate, rating_breakdown={key: dict(value) for key, value in rating_breakdown.items()}, choice_breakdown={key: dict(value) for key, value in choice_breakdown.items()}, text_feedback=text_feedback)
