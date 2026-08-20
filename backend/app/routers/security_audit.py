"""
Security Audit Log endpoints.
Allows authenticated users to view their account security event history.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.security_audit import SecurityAuditLog
from app.models.user import User

router = APIRouter(prefix="/api/auth/audit-logs", tags=["security_audit"])


class SecurityAuditLogResponse(BaseModel):
    id: int
    event_type: str
    status: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=List[SecurityAuditLogResponse])
def get_user_security_audit_logs(
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns security events associated with the authenticated user (logins, MFA, password updates).
    """
    logs = (
        db.query(SecurityAuditLog)
        .filter(SecurityAuditLog.user_id == current_user.id)
        .order_by(SecurityAuditLog.id.desc())
        .limit(limit)
        .all()
    )
    return logs
