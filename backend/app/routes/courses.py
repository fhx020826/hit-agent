from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import (
    DBAgentConfig,
    DBAIDiscussionContextLog,
    DBAssignment,
    DBAssignmentFeedback,
    DBAssignmentReceipt,
    DBAssignmentSubmission,
    DBChatSession,
    DBClassroomShare,
    DBCourse,
    DBCourseClass,
    DBDiscussionMessage,
    DBDiscussionMessageAttachment,
    DBDiscussionSpace,
    DBDiscussionSpaceMember,
    DBKnowledgeChunk,
    DBLearningNotebook,
    DBLearningNotebookImage,
    DBLessonPack,
    DBMaterial,
    DBMaterialAnnotation,
    DBMaterialRequest,
    DBMaterialShareRecord,
    DBMaterialUpdateJob,
    DBQALog,
    DBQuestion,
    DBQuestionAttachment,
    DBQuestionFolder,
    DBSavedAnnotationVersion,
    DBSurveyInstance,
    DBSurveyResponse,
    DBTaskJob,
    DBTeacherNotification,
    DBWeaknessAnalysis,
    get_db,
)
from ..models.schemas import Course, CourseCreate
from ..security import get_current_user, require_roles
from ..services.discussion_service import ensure_discussion_space_for_course_class

router = APIRouter(prefix="/api/courses", tags=["courses"])


def _db_to_course(row: DBCourse) -> Course:
    return Course(
        id=row.id,
        name=row.name,
        audience=row.audience,
        class_name=row.class_name or "",
        student_level=row.student_level,
        chapter=row.chapter,
        objectives=row.objectives,
        duration_minutes=row.duration_minutes,
        frontier_direction=row.frontier_direction,
        owner_user_id=row.owner_user_id or "",
        created_at=row.created_at,
    )


def _get_owned_course_or_404(db: Session, course_id: str, current_user: dict) -> DBCourse:
    row = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课程不存在")
    if row.owner_user_id and row.owner_user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="只能管理自己的课程")
    return row


def _delete_course_related_records(db: Session, course_id: str) -> None:
    lesson_pack_ids = [item[0] for item in db.query(DBLessonPack.id).filter(DBLessonPack.course_id == course_id).all()]
    material_ids = [item[0] for item in db.query(DBMaterial.id).filter(DBMaterial.course_id == course_id).all()]
    share_ids = [item[0] for item in db.query(DBMaterialShareRecord.id).filter(DBMaterialShareRecord.course_id == course_id).all()]
    assignment_ids = [item[0] for item in db.query(DBAssignment.id).filter(DBAssignment.course_id == course_id).all()]
    submission_ids = [item[0] for item in db.query(DBAssignmentSubmission.id).filter(DBAssignmentSubmission.assignment_id.in_(assignment_ids)).all()] if assignment_ids else []
    session_ids = [item[0] for item in db.query(DBChatSession.id).filter(DBChatSession.course_id == course_id).all()]
    question_ids = [item[0] for item in db.query(DBQuestion.id).filter(DBQuestion.course_id == course_id).all()]
    notebook_ids = [item[0] for item in db.query(DBLearningNotebook.id).filter(DBLearningNotebook.course_id == course_id).all()]
    survey_instance_ids = [item[0] for item in db.query(DBSurveyInstance.id).filter(DBSurveyInstance.course_id == course_id).all()]
    space_ids = [item[0] for item in db.query(DBDiscussionSpace.id).filter(DBDiscussionSpace.course_id == course_id).all()]
    message_ids = [item[0] for item in db.query(DBDiscussionMessage.id).filter(DBDiscussionMessage.space_id.in_(space_ids)).all()] if space_ids else []

    if submission_ids:
        db.query(DBAssignmentFeedback).filter(DBAssignmentFeedback.submission_id.in_(submission_ids)).delete(synchronize_session=False)
    if assignment_ids:
        db.query(DBAssignmentReceipt).filter(DBAssignmentReceipt.assignment_id.in_(assignment_ids)).delete(synchronize_session=False)
        db.query(DBAssignmentSubmission).filter(DBAssignmentSubmission.assignment_id.in_(assignment_ids)).delete(synchronize_session=False)
        db.query(DBAssignment).filter(DBAssignment.id.in_(assignment_ids)).delete(synchronize_session=False)

    if question_ids:
        db.query(DBQuestionAttachment).filter(DBQuestionAttachment.question_id.in_(question_ids)).delete(synchronize_session=False)
        db.query(DBTeacherNotification).filter(DBTeacherNotification.related_question_id.in_(question_ids)).delete(synchronize_session=False)
        db.query(DBQuestion).filter(DBQuestion.id.in_(question_ids)).delete(synchronize_session=False)

    if session_ids:
        db.query(DBChatSession).filter(DBChatSession.id.in_(session_ids)).delete(synchronize_session=False)

    if notebook_ids:
        db.query(DBLearningNotebookImage).filter(DBLearningNotebookImage.notebook_id.in_(notebook_ids)).delete(synchronize_session=False)
        db.query(DBLearningNotebook).filter(DBLearningNotebook.id.in_(notebook_ids)).delete(synchronize_session=False)

    if survey_instance_ids:
        db.query(DBSurveyResponse).filter(DBSurveyResponse.survey_instance_id.in_(survey_instance_ids)).delete(synchronize_session=False)
        db.query(DBSurveyInstance).filter(DBSurveyInstance.id.in_(survey_instance_ids)).delete(synchronize_session=False)

    if message_ids:
        db.query(DBDiscussionMessageAttachment).filter(DBDiscussionMessageAttachment.message_id.in_(message_ids)).delete(synchronize_session=False)
        db.query(DBDiscussionMessage).filter(DBDiscussionMessage.id.in_(message_ids)).delete(synchronize_session=False)
    if space_ids:
        db.query(DBAIDiscussionContextLog).filter(DBAIDiscussionContextLog.space_id.in_(space_ids)).delete(synchronize_session=False)
        db.query(DBDiscussionSpaceMember).filter(DBDiscussionSpaceMember.space_id.in_(space_ids)).delete(synchronize_session=False)
        db.query(DBDiscussionSpace).filter(DBDiscussionSpace.id.in_(space_ids)).delete(synchronize_session=False)

    if material_ids:
        db.query(DBMaterialAnnotation).filter(DBMaterialAnnotation.material_id.in_(material_ids)).delete(synchronize_session=False)
        db.query(DBSavedAnnotationVersion).filter(DBSavedAnnotationVersion.material_id.in_(material_ids)).delete(synchronize_session=False)
        db.query(DBMaterial).filter(DBMaterial.id.in_(material_ids)).delete(synchronize_session=False)
    if share_ids:
        db.query(DBMaterialAnnotation).filter(DBMaterialAnnotation.share_record_id.in_(share_ids)).delete(synchronize_session=False)
        db.query(DBSavedAnnotationVersion).filter(DBSavedAnnotationVersion.share_record_id.in_(share_ids)).delete(synchronize_session=False)
        db.query(DBMaterialShareRecord).filter(DBMaterialShareRecord.id.in_(share_ids)).delete(synchronize_session=False)

    if lesson_pack_ids:
        db.query(DBQALog).filter(DBQALog.lesson_pack_id.in_(lesson_pack_ids)).delete(synchronize_session=False)
        db.query(DBLessonPack).filter(DBLessonPack.id.in_(lesson_pack_ids)).delete(synchronize_session=False)

    db.query(DBAgentConfig).filter(DBAgentConfig.course_id == course_id).delete(synchronize_session=False)
    db.query(DBQuestionFolder).filter(DBQuestionFolder.course_id == course_id).delete(synchronize_session=False)
    db.query(DBWeaknessAnalysis).filter(DBWeaknessAnalysis.course_id == course_id).delete(synchronize_session=False)
    db.query(DBMaterialUpdateJob).filter(DBMaterialUpdateJob.course_id == course_id).delete(synchronize_session=False)
    db.query(DBKnowledgeChunk).filter(DBKnowledgeChunk.course_id == course_id).delete(synchronize_session=False)
    db.query(DBClassroomShare).filter(DBClassroomShare.course_id == course_id).delete(synchronize_session=False)
    db.query(DBMaterialRequest).filter(DBMaterialRequest.course_id == course_id).delete(synchronize_session=False)
    db.query(DBCourseClass).filter(DBCourseClass.course_id == course_id).delete(synchronize_session=False)
    db.query(DBTaskJob).filter(DBTaskJob.course_id == course_id).delete(synchronize_session=False)
    db.query(DBCourse).filter(DBCourse.id == course_id).delete(synchronize_session=False)


@router.post("", response_model=Course)
def create_course(body: CourseCreate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    row = DBCourse(
        id=f"course-{uuid4().hex[:8]}",
        name=body.name,
        audience=body.audience,
        class_name=body.class_name or body.audience,
        student_level=body.student_level,
        chapter=body.chapter,
        objectives=body.objectives,
        duration_minutes=body.duration_minutes,
        frontier_direction=body.frontier_direction,
        owner_user_id=current_user["id"],
        created_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.flush()
    target_class = body.class_name or body.audience
    if target_class:
        ensure_discussion_space_for_course_class(db, course=row, class_name=target_class, teacher_user_id=current_user["id"])
    db.commit()
    db.refresh(row)
    return _db_to_course(row)


@router.get("", response_model=list[Course])
def list_courses(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(DBCourse).order_by(DBCourse.created_at.desc()).all()
    return [_db_to_course(row) for row in rows]


@router.get("/{course_id}", response_model=Course)
def get_course(course_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(DBCourse).filter(DBCourse.id == course_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="课程不存在")
    return _db_to_course(row)


@router.put("/{course_id}", response_model=Course)
def update_course(course_id: str, body: CourseCreate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    row = _get_owned_course_or_404(db, course_id, current_user)
    row.name = body.name
    row.audience = body.audience
    row.class_name = body.class_name or body.audience
    row.student_level = body.student_level
    row.chapter = body.chapter
    row.objectives = body.objectives
    row.duration_minutes = body.duration_minutes
    row.frontier_direction = body.frontier_direction
    db.commit()
    db.refresh(row)
    return _db_to_course(row)


@router.delete("/{course_id}")
def delete_course(course_id: str, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    _get_owned_course_or_404(db, course_id, current_user)
    _delete_course_related_records(db, course_id)
    db.commit()
    return {"status": "deleted", "message": "课程及相关课程包记录已删除"}
