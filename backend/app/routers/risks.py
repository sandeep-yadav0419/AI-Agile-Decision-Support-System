"""
Risk management endpoints with strict multi-tenant authorization.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import (
    check_project_access,
    get_current_user,
    get_user_authorized_project_ids,
)
from app.database import get_db
from app.models.project import Project
from app.models.risk import Risk
from app.models.user import User
from app.schemas.risk import RiskCreate, RiskResponse

router = APIRouter(prefix="/api/risks", tags=["risks"])


@router.get("", response_model=List[RiskResponse])
def list_risks(
    project_id: Optional[int] = Query(None),
    sprint_id: Optional[int] = Query(None),
    severity: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    authorized_project_ids = get_user_authorized_project_ids(current_user, db)
    if not authorized_project_ids:
        return []

    if project_id:
        check_project_access(project_id, current_user, db)
        query = db.query(Risk).filter(Risk.project_id == project_id)
    else:
        query = db.query(Risk).filter(Risk.project_id.in_(authorized_project_ids))

    if sprint_id:
        query = query.filter(Risk.sprint_id == sprint_id)
    if severity and severity != "All":
        query = query.filter(Risk.severity == severity.upper())
    if status_filter and status_filter != "All":
        query = query.filter(Risk.status == status_filter)

    risks = query.order_by(Risk.id.desc()).all()
    results = []
    for r in risks:
        r_resp = RiskResponse.model_validate(r)
        r_resp.task_title = r.task.title if r.task else None
        r_resp.sprint_name = r.sprint.name if r.sprint else None
        results.append(r_resp)
    return results


@router.post("", response_model=RiskResponse, status_code=status.HTTP_201_CREATED)
def create_risk(
    payload: RiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = check_project_access(payload.project_id, current_user, db, require_owner_or_pm=True)

    risk = Risk(
        project_id=payload.project_id,
        sprint_id=payload.sprint_id,
        task_id=payload.task_id,
        risk_type=payload.risk_type.strip(),
        severity=payload.severity.upper() if payload.severity else "MEDIUM",
        description=payload.description.strip(),
        mitigation=payload.mitigation.strip() if payload.mitigation else None,
        status=payload.status or "Active",
    )
    db.add(risk)
    db.commit()
    db.refresh(risk)

    r_resp = RiskResponse.model_validate(risk)
    r_resp.task_title = risk.task.title if risk.task else None
    r_resp.sprint_name = risk.sprint.name if risk.sprint else None
    return r_resp


@router.patch("/{risk_id}/status", response_model=RiskResponse)
def update_risk_status(
    risk_id: int,
    status_val: str = Query(..., alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    risk = db.query(Risk).filter(Risk.id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk not found")

    check_project_access(risk.project_id, current_user, db)

    valid_statuses = ["Active", "Mitigated", "Resolved", "Dismissed"]
    if status_val not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{status_val}'. Must be one of {valid_statuses}",
        )

    risk.status = status_val
    db.commit()
    db.refresh(risk)

    r_resp = RiskResponse.model_validate(risk)
    r_resp.task_title = risk.task.title if risk.task else None
    r_resp.sprint_name = risk.sprint.name if risk.sprint else None
    return r_resp


@router.delete("/{risk_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_risk(
    risk_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    risk = db.query(Risk).filter(Risk.id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk not found")

    check_project_access(risk.project_id, current_user, db, require_owner_or_pm=True)

    db.delete(risk)
    db.commit()
    return None
