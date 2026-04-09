"""Assignment review preview routes."""

from __future__ import annotations

from fastapi import APIRouter

from ..models.schemas import AssignmentReviewRequest, AssignmentReviewResponse
from ..services.llm_service import assignment_review_preview

router = APIRouter(prefix="/api/assignment-review", tags=["assignment-review"])


@router.post("/preview", response_model=AssignmentReviewResponse)
def preview_assignment_review(body: AssignmentReviewRequest):
    return assignment_review_preview(body)
