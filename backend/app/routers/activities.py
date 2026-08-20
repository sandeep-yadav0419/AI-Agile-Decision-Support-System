"""
Activity log and event timeline endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import check_project_access, get_current_user, get_user_authorized_project_ids
from app.database import get_db
from app.models.activity import ActivityLog
from app.models.user import User
from app.schemas.activity import ActivityLogResponse

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("", response_model=List[ActivityLogResponse])
def list_activities(
    project_id: Optional[int] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    authorized_project_ids = get_user_authorized_project_ids(current_user, db)
    if not authorized_project_ids:
        return []

    if project_id:
        check_project_access(project_id, current_user, db)
        query = db.query(ActivityLog).filter(ActivityLog.project_id == project_id)
    else:
        query = db.query(ActivityLog).filter(ActivityLog.project_id.in_(authorized_project_ids))

    activities = query.order_by(ActivityLog.id.desc()).limit(limit).all()
    return activities
