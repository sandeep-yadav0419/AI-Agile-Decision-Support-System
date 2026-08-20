"""
Pydantic schemas for Activity Logs.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.schemas.user import UserBrief


class ActivityLogResponse(BaseModel):
    id: int
    project_id: int
    actor_user_id: Optional[int] = None
    event_type: str
    description: str
    created_at: datetime
    actor: Optional[UserBrief] = None

    model_config = {"from_attributes": True}
