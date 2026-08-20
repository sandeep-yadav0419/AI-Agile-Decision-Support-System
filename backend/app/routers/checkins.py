"""
Daily check-in standup endpoints.
"""
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import check_project_access, get_current_user, get_user_authorized_project_ids, log_activity
from app.database import get_db
from app.models.checkin import DailyCheckIn
from app.models.user import User
from app.schemas.checkin import DailyCheckInCreate, DailyCheckInResponse

router = APIRouter(prefix="/api/checkins", tags=["checkins"])


@router.get("", response_model=List[DailyCheckInResponse])
def list_checkins(
    project_id: Optional[int] = Query(None),
    checkin_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    authorized_project_ids = get_user_authorized_project_ids(current_user, db)
    if not authorized_project_ids:
        return []

    if project_id:
        check_project_access(project_id, current_user, db)
        query = db.query(DailyCheckIn).filter(DailyCheckIn.project_id == project_id)
    else:
        query = db.query(DailyCheckIn).filter(DailyCheckIn.project_id.in_(authorized_project_ids))

    if checkin_date:
        query = query.filter(DailyCheckIn.date == checkin_date)

    checkins = query.order_by(DailyCheckIn.id.desc()).all()
    return checkins


@router.post("", response_model=DailyCheckInResponse, status_code=status.HTTP_201_CREATED)
def submit_checkin(
    payload: DailyCheckInCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = check_project_access(payload.project_id, current_user, db)
    today = date.today()

    # Check if user already submitted a check-in for today
    existing = (
        db.query(DailyCheckIn)
        .filter(
            DailyCheckIn.project_id == payload.project_id,
            DailyCheckIn.user_id == current_user.id,
            DailyCheckIn.date == today,
        )
        .first()
    )

    if existing:
        existing.completed_today = payload.completed_today.strip()
        existing.working_on = payload.working_on.strip()
        existing.is_blocked = payload.is_blocked
        existing.blocker_description = payload.blocker_description.strip() if payload.blocker_description else None
        existing.estimated_completion = payload.estimated_completion
        existing.notes = payload.notes
        db.commit()
        db.refresh(existing)
        checkin_obj = existing
    else:
        checkin_obj = DailyCheckIn(
            project_id=payload.project_id,
            user_id=current_user.id,
            date=today,
            completed_today=payload.completed_today.strip(),
            working_on=payload.working_on.strip(),
            is_blocked=payload.is_blocked,
            blocker_description=payload.blocker_description.strip() if payload.blocker_description else None,
            estimated_completion=payload.estimated_completion,
            notes=payload.notes,
        )
        db.add(checkin_obj)
        db.commit()
        db.refresh(checkin_obj)

    log_activity(
        db,
        project_id=project.id,
        actor_user_id=current_user.id,
        event_type="DAILY_CHECKIN_SUBMITTED",
        description=f"{current_user.full_name} submitted a daily check-in (Blocked: {'YES' if checkin_obj.is_blocked else 'NO'}).",
    )

    return checkin_obj
