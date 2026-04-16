from __future__ import annotations

import json
import os
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import (
    ASSIGNMENT_UPLOAD_DIR,
    DBAssignment,
    DBAssignmentFeedback,
    DBAssignmentReceipt,
    DBAssignmentSubmission,
    DBCourse,
    DBCourseClass,
    DBUser,
    DBUserProfile,
    get_db,
)
from ..models.schemas import (
    AssignmentCreate,
    AssignmentFeedbackSummary,
    AssignmentReceiptStatus,
    AssignmentStudentView,
    AssignmentSubmissionItem,
    AssignmentSubmissionSummary,
    AssignmentSummary,
    AssignmentTeacherDetail,
    AssignmentTeacherRosterItem,
    CourseClassItem,
)
from ..security import get_current_user, require_roles
from ..services.course_membership import (
    active_course_member,
    ensure_student_course_access,
    ensure_teacher_course_access,
    list_course_class_rows,
    list_course_members,
    student_course_class_names,
)
from ..services.llm_service import assignment_review_preview, extract_text_from_file

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


def _assignment_to_schema(row: DBAssignment) -> AssignmentSummary:
    return AssignmentSummary(
        id=row.id,
        teacher_id=row.teacher_id,
        course_id=row.course_id,
        title=row.title,
        description=row.description,
        target_class=row.target_class,
        deadline=row.deadline,
        attachment_requirements=row.attachment_requirements,
        submission_format=row.submission_format,
        grading_notes=row.grading_notes,
        allow_resubmit=bool(row.allow_resubmit),
        enable_ai_feedback=bool(row.enable_ai_feedback),
        remind_days=row.remind_days,
        status=row.status,
        created_at=row.created_at,
    )


def _submission_to_schema(row: DBAssignmentSubmission | None) -> AssignmentSubmissionSummary | None:
    if not row:
        return None
    files = []
    for item in json.loads(row.files_json or "[]"):
        files.append(AssignmentSubmissionItem(file_name=item["file_name"], file_type=item["file_type"], file_size=item["file_size"], download_url=f"/api/assignments/submissions/{row.id}/files/{item['token']}"))
    return AssignmentSubmissionSummary(id=row.id, assignment_id=row.assignment_id, student_id=row.student_id, status=row.status, submitted_at=row.submitted_at, resubmitted_count=row.resubmitted_count, files=files)


def _teacher_course_rows(current_user: dict, db: Session) -> list[DBCourse]:
    owned_rows = db.query(DBCourse).filter(DBCourse.owner_user_id == current_user["id"]).order_by(DBCourse.created_at.desc()).all()
    profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == current_user["id"]).first()
    common_courses = set(json.loads(profile.common_courses_json or "[]")) if profile and profile.common_courses_json else set()
    if not common_courses:
        return owned_rows

    all_rows = db.query(DBCourse).order_by(DBCourse.created_at.desc()).all()
    merged: list[DBCourse] = []
    seen: set[str] = set()
    for row in owned_rows + [item for item in all_rows if item.name in common_courses]:
        if row.id in seen:
            continue
        seen.add(row.id)
        merged.append(row)
    return merged


def _teacher_class_options(current_user: dict, db: Session, course_id: str = "") -> list[CourseClassItem]:
    rows = _teacher_course_rows(current_user, db)
    if course_id:
        rows = [row for row in rows if row.id == course_id]

    options: list[CourseClassItem] = []
    seen: set[tuple[str, str]] = set()
    for course in rows:
        primary_class = (course.class_name or course.audience or "").strip()
        if primary_class and (course.id, primary_class) not in seen:
            seen.add((course.id, primary_class))
            options.append(CourseClassItem(id=f"{course.id}:{primary_class}", course_id=course.id, class_name=primary_class, discussion_space_id=""))

        extra_classes = list_course_class_rows(db, course.id)
        for item in extra_classes:
            class_name = (item.class_name or "").strip()
            if not class_name or (course.id, class_name) in seen:
                continue
            seen.add((course.id, class_name))
            options.append(CourseClassItem(id=item.id, course_id=course.id, class_name=class_name, discussion_space_id=item.discussion_space_id or ""))

    return options


@router.post("", response_model=AssignmentSummary)
def create_assignment(body: AssignmentCreate, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    ensure_teacher_course_access(body.course_id, current_user, db)
    row = DBAssignment(
        id=f"asg-{uuid4().hex[:8]}",
        teacher_id=current_user["id"],
        course_id=body.course_id,
        title=body.title,
        description=body.description,
        target_class=body.target_class,
        deadline=body.deadline,
        attachment_requirements=body.attachment_requirements,
        submission_format=body.submission_format,
        grading_notes=body.grading_notes,
        allow_resubmit=1 if body.allow_resubmit else 0,
        enable_ai_feedback=1 if body.enable_ai_feedback else 0,
        remind_days=body.remind_days,
        status="open",
        created_at=datetime.now().isoformat(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _assignment_to_schema(row)


@router.get("/teacher", response_model=list[AssignmentSummary])
def list_teacher_assignments(current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    rows = db.query(DBAssignment).filter(DBAssignment.teacher_id == current_user["id"]).order_by(DBAssignment.created_at.desc()).all()
    return [_assignment_to_schema(row) for row in rows]


@router.get("/teacher/class-options", response_model=list[CourseClassItem])
def list_teacher_class_options(
    course_id: str | None = Query(default=None),
    current_user: dict = Depends(require_roles("teacher")),
    db: Session = Depends(get_db),
):
    return _teacher_class_options(current_user, db, course_id or "")


@router.get("/student", response_model=list[AssignmentStudentView])
def list_student_assignments(current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    rows = db.query(DBAssignment).order_by(DBAssignment.created_at.desc()).all()
    result = []
    for row in rows:
        member = active_course_member(db, course_id=row.course_id, user_id=current_user["id"], role="student")
        if not member:
            continue
        if row.target_class and row.target_class != (member.class_name or ""):
            continue
        receipt = db.query(DBAssignmentReceipt).filter(DBAssignmentReceipt.assignment_id == row.id, DBAssignmentReceipt.student_id == current_user["id"]).first()
        submission = db.query(DBAssignmentSubmission).filter(DBAssignmentSubmission.assignment_id == row.id, DBAssignmentSubmission.student_id == current_user["id"]).first()
        feedback = db.query(DBAssignmentFeedback).filter(DBAssignmentFeedback.submission_id == submission.id).first() if submission else None
        result.append(AssignmentStudentView(
            assignment=_assignment_to_schema(row),
            receipt=AssignmentReceiptStatus(assignment_id=row.id, confirmed=bool(receipt and receipt.confirmed), confirmed_at=receipt.confirmed_at if receipt else ""),
            submission=_submission_to_schema(submission),
            feedback=AssignmentFeedbackSummary(
                summary=feedback.summary,
                structure_feedback=json.loads(feedback.structure_feedback or "[]"),
                logic_feedback=json.loads(feedback.logic_feedback or "[]"),
                writing_feedback=json.loads(feedback.writing_feedback or "[]"),
                rubric_reference=json.loads(feedback.rubric_reference or "[]"),
                teacher_note=feedback.teacher_note,
                created_at=feedback.created_at,
            ) if feedback else None,
        ))
    return result


@router.post("/{assignment_id}/confirm", response_model=AssignmentReceiptStatus)
def confirm_assignment(assignment_id: str, current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    assignment = db.query(DBAssignment).filter(DBAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="作业不存在")
    ensure_student_course_access(assignment.course_id, current_user, db)
    row = db.query(DBAssignmentReceipt).filter(DBAssignmentReceipt.assignment_id == assignment_id, DBAssignmentReceipt.student_id == current_user["id"]).first()
    if not row:
        row = DBAssignmentReceipt(id=f"rcpt-{uuid4().hex[:8]}", assignment_id=assignment_id, student_id=current_user["id"], created_at=datetime.now().isoformat())
        db.add(row)
    row.confirmed = 1
    row.confirmed_at = datetime.now().isoformat()
    db.commit()
    return AssignmentReceiptStatus(assignment_id=assignment_id, confirmed=True, confirmed_at=row.confirmed_at)


@router.post("/{assignment_id}/submit", response_model=AssignmentSubmissionSummary)
def submit_assignment(assignment_id: str, files: list[UploadFile] = File(...), current_user: dict = Depends(require_roles("student")), db: Session = Depends(get_db)):
    assignment = db.query(DBAssignment).filter(DBAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="作业不存在")
    ensure_student_course_access(assignment.course_id, current_user, db)
    submission = db.query(DBAssignmentSubmission).filter(DBAssignmentSubmission.assignment_id == assignment_id, DBAssignmentSubmission.student_id == current_user["id"]).first()
    now = datetime.now().isoformat()
    if submission and not bool(assignment.allow_resubmit):
        raise HTTPException(status_code=400, detail="当前作业不允许重新提交")
    if not submission:
        submission = DBAssignmentSubmission(id=f"sub-{uuid4().hex[:8]}", assignment_id=assignment_id, student_id=current_user["id"], created_at=now)
        db.add(submission)
    else:
        submission.resubmitted_count = int(submission.resubmitted_count or 0) + 1

    user_dir = os.path.join(ASSIGNMENT_UPLOAD_DIR, current_user["id"], assignment_id)
    os.makedirs(user_dir, exist_ok=True)
    saved_files = []
    parsed_parts = []
    for file in files:
        content = file.file.read()
        token = uuid4().hex[:8]
        path = os.path.join(user_dir, f"{token}_{file.filename}")
        with open(path, "wb") as output:
            output.write(content)
        ext = os.path.splitext(file.filename or "")[1].lower()
        summary, status = extract_text_from_file(path, ext)
        if summary and status in {"parsed", "indexed"}:
            parsed_parts.append(f"[{file.filename}] {summary}")
        saved_files.append({"token": token, "file_name": file.filename or token, "file_type": ext, "file_size": len(content), "file_path": path})

    submission.files_json = json.dumps(saved_files, ensure_ascii=False)
    submission.submitted_at = now
    submission.status = "submitted"
    submission.updated_at = now

    receipt = db.query(DBAssignmentReceipt).filter(DBAssignmentReceipt.assignment_id == assignment_id, DBAssignmentReceipt.student_id == current_user["id"]).first()
    if not receipt:
        receipt = DBAssignmentReceipt(id=f"rcpt-{uuid4().hex[:8]}", assignment_id=assignment_id, student_id=current_user["id"], created_at=now)
        db.add(receipt)
    receipt.confirmed = 1
    receipt.confirmed_at = receipt.confirmed_at or now

    if bool(assignment.enable_ai_feedback):
        feedback_row = db.query(DBAssignmentFeedback).filter(DBAssignmentFeedback.submission_id == submission.id).first()
        review = assignment_review_preview(type("AssignmentReviewBody", (), {
            "course_id": assignment.course_id,
            "assignment_type": "作业",
            "title": assignment.title,
            "requirements": assignment.description,
            "submission_text": "\n\n".join(parsed_parts) or "当前提交文件暂缺少可直接解析的正文内容。",
        })())
        if not feedback_row:
            feedback_row = DBAssignmentFeedback(id=f"fb-{uuid4().hex[:8]}", submission_id=submission.id)
            db.add(feedback_row)
        feedback_row.summary = review.summary
        feedback_row.structure_feedback = json.dumps(review.structure_feedback, ensure_ascii=False)
        feedback_row.logic_feedback = json.dumps(review.logic_feedback, ensure_ascii=False)
        feedback_row.writing_feedback = json.dumps(review.writing_feedback, ensure_ascii=False)
        feedback_row.rubric_reference = json.dumps(review.rubric_reference, ensure_ascii=False)
        feedback_row.teacher_note = review.teacher_note
        feedback_row.created_at = now

    db.commit()
    db.refresh(submission)
    return _submission_to_schema(submission)


@router.get("/teacher/{assignment_id}", response_model=AssignmentTeacherDetail)
def get_assignment_teacher_detail(assignment_id: str, current_user: dict = Depends(require_roles("teacher")), db: Session = Depends(get_db)):
    assignment = db.query(DBAssignment).filter(DBAssignment.id == assignment_id, DBAssignment.teacher_id == current_user["id"]).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="作业不存在")
    students = db.query(DBUser).filter(DBUser.role == "student").all()
    profiles = {row.user_id: row for row in db.query(DBUserProfile).all()}
    receipts = {(row.student_id): row for row in db.query(DBAssignmentReceipt).filter(DBAssignmentReceipt.assignment_id == assignment_id).all()}
    submissions = {(row.student_id): row for row in db.query(DBAssignmentSubmission).filter(DBAssignmentSubmission.assignment_id == assignment_id).all()}

    member_rows = list_course_members(db, assignment.course_id, role="student")
    allowed_ids = {
        item.user_id
        for item in member_rows
        if assignment.target_class in {"", (item.class_name or "")}
    }
    target_students = [student for student in students if student.id in allowed_ids]
    submitted_students = []
    unsubmitted_students = []
    confirmed_but_unsubmitted = []
    unconfirmed_students = []

    for student in target_students:
        profile = profiles.get(student.id)
        receipt = receipts.get(student.id)
        submission = submissions.get(student.id)
        item = AssignmentTeacherRosterItem(
            user_id=student.id,
            display_name=student.display_name,
            class_name=profile.class_name if profile else "",
            confirmed=bool(receipt and receipt.confirmed),
            confirmed_at=receipt.confirmed_at if receipt else "",
            submitted=bool(submission and submission.status == "submitted"),
            submitted_at=submission.submitted_at if submission else "",
        )
        if item.submitted:
            submitted_students.append(item)
        else:
            unsubmitted_students.append(item)
            if item.confirmed:
                confirmed_but_unsubmitted.append(item)
            else:
                unconfirmed_students.append(item)

    return AssignmentTeacherDetail(
        assignment=_assignment_to_schema(assignment),
        submitted_students=submitted_students,
        unsubmitted_students=unsubmitted_students,
        confirmed_but_unsubmitted=confirmed_but_unsubmitted,
        unconfirmed_students=unconfirmed_students,
    )


@router.get("/submissions/{submission_id}/files/{token}")
def download_submission_file(submission_id: str, token: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    submission = db.query(DBAssignmentSubmission).filter(DBAssignmentSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="提交记录不存在")
    assignment = db.query(DBAssignment).filter(DBAssignment.id == submission.assignment_id).first()
    if current_user["role"] == "student" and submission.student_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="无权访问该文件")
    if current_user["role"] == "teacher" and assignment and assignment.teacher_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="无权访问该文件")
    for item in json.loads(submission.files_json or "[]"):
        if item["token"] == token:
            return FileResponse(item["file_path"], filename=item["file_name"])
    raise HTTPException(status_code=404, detail="文件不存在")
