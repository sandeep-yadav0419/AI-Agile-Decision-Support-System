"""
AI Decision Support System endpoints with strict multi-tenant authorization.
"""
from typing import Optional
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    check_project_access,
    get_current_user,
    get_user_authorized_project_ids,
)
from app.database import get_db
from app.models.project import Project
from app.models.sprint import Sprint
from app.models.user import User
from app.schemas.ai import (
    AIAnalysisOverview,
    DeliveryForecast,
    ProjectHealthSummary,
    SprintHealthAnalysis,
)
from app.services.ai_engine import (
    evaluate_sprint_health,
    generate_delivery_forecast,
    generate_system_ai_overview,
    get_full_project_health,
    sync_project_ai_insights,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/overview", response_model=AIAnalysisOverview)
def get_ai_system_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    authorized_ids = get_user_authorized_project_ids(current_user, db)
    return generate_system_ai_overview(db, authorized_project_ids=authorized_ids)


@router.get("/projects/{project_id}/health", response_model=ProjectHealthSummary)
@router.get("/project/{project_id}", response_model=ProjectHealthSummary)
def get_project_health(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)
    try:
        return get_full_project_health(project_id, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/sprints/{sprint_id}/health", response_model=SprintHealthAnalysis)
@router.get("/sprint/{sprint_id}", response_model=SprintHealthAnalysis)
def get_sprint_health(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    check_project_access(sprint.project_id, current_user, db)
    return evaluate_sprint_health(sprint, db)


@router.get("/projects/{project_id}/forecast", response_model=DeliveryForecast)
def get_project_forecast(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = check_project_access(project_id, current_user, db)
    return generate_delivery_forecast(project, db)


@router.post("/sync/{project_id}")
def sync_ai_insights(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)
    risks, recs = sync_project_ai_insights(project_id, db)
    return {
        "message": "AI analysis complete and insights updated",
        "active_risks": len([r for r in risks if r.status == "Active"]),
        "pending_recommendations": len([rec for rec in recs if rec.status == "pending"]),
    }


@router.post("/analyze")
def analyze_all_or_project(
    project_id: Optional[int] = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Triggers AI decision analysis across authorized projects or a specified authorized project.
    """
    authorized_ids = get_user_authorized_project_ids(current_user, db)

    if project_id:
        check_project_access(project_id, current_user, db)
        target_projects = db.query(Project).filter(Project.id == project_id).all()
    else:
        target_projects = db.query(Project).filter(Project.id.in_(authorized_ids)).all()

    total_risks = 0
    total_recs = 0
    for p in target_projects:
        risks, recs = sync_project_ai_insights(p.id, db)
        total_risks += len([r for r in risks if r.status == "Active"])
        total_recs += len([rec for rec in recs if rec.status == "pending"])

    return {
        "message": f"AI analysis completed across {len(target_projects)} project(s)",
        "active_risks": total_risks,
        "pending_recommendations": total_recs,
    }
