"""
AI Decision Recommendation endpoints with strict multi-tenant authorization.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import (
    check_project_access,
    get_current_user,
    get_user_authorized_project_ids,
    log_activity,
)
from app.database import get_db
from app.models.project import Project
from app.models.recommendation import DecisionRecommendation
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.user import User
from app.schemas.recommendation import (
    RecommendationCreate,
    RecommendationResponse,
    RecommendationStatusUpdate,
)

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("", response_model=List[RecommendationResponse])
def list_recommendations(
    project_id: Optional[int] = Query(None),
    sprint_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    authorized_project_ids = get_user_authorized_project_ids(current_user, db)
    if not authorized_project_ids:
        return []

    if project_id:
        check_project_access(project_id, current_user, db)
        query = db.query(DecisionRecommendation).filter(DecisionRecommendation.project_id == project_id)
    else:
        query = db.query(DecisionRecommendation).filter(DecisionRecommendation.project_id.in_(authorized_project_ids))

    if sprint_id:
        query = query.filter(DecisionRecommendation.sprint_id == sprint_id)
    if category and category != "All":
        query = query.filter(DecisionRecommendation.category == category)
    if status_filter and status_filter != "All":
        query = query.filter(DecisionRecommendation.status == status_filter)

    recs = query.order_by(DecisionRecommendation.impact_score.desc(), DecisionRecommendation.id.desc()).all()
    results = []
    for r in recs:
        r_resp = RecommendationResponse.model_validate(r)
        r_resp.sprint_name = r.sprint.name if r.sprint else None
        results.append(r_resp)
    return results


@router.post("", response_model=RecommendationResponse, status_code=status.HTTP_201_CREATED)
def create_recommendation(
    payload: RecommendationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = check_project_access(payload.project_id, current_user, db, require_owner_or_pm=True)

    rec = DecisionRecommendation(
        project_id=payload.project_id,
        sprint_id=payload.sprint_id,
        title=payload.title.strip(),
        category=payload.category,
        priority=payload.priority,
        reason=payload.reason.strip(),
        action_text=payload.action_text.strip(),
        status=payload.status or "pending",
        impact_score=payload.impact_score or 75,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    r_resp = RecommendationResponse.model_validate(rec)
    r_resp.sprint_name = rec.sprint.name if rec.sprint else None
    return r_resp


@router.patch("/{rec_id}/status", response_model=RecommendationResponse)
def update_recommendation_status(
    rec_id: int,
    payload: RecommendationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = db.query(DecisionRecommendation).filter(DecisionRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")

    check_project_access(rec.project_id, current_user, db)

    valid_statuses = ["pending", "reviewed", "accepted", "dismissed"]
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Must be one of {valid_statuses}",
        )

    rec.status = payload.status
    db.commit()
    db.refresh(rec)

    r_resp = RecommendationResponse.model_validate(rec)
    r_resp.sprint_name = rec.sprint.name if rec.sprint else None
    return r_resp


@router.post("/{rec_id}/apply", response_model=RecommendationResponse)
def apply_recommendation(
    rec_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = db.query(DecisionRecommendation).filter(DecisionRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")

    project = check_project_access(rec.project_id, current_user, db)

    # Mark as accepted
    rec.status = "accepted"
    db.commit()
    db.refresh(rec)

    log_activity(
        db,
        project_id=project.id,
        actor_user_id=current_user.id,
        event_type="RECOMMENDATION_ACCEPTED",
        description=f"{current_user.full_name} accepted recommendation '{rec.title}'.",
    )

    r_resp = RecommendationResponse.model_validate(rec)
    r_resp.sprint_name = rec.sprint.name if rec.sprint else None
    return r_resp
