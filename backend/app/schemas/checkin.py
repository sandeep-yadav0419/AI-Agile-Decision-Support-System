"""
Pydantic schemas for Daily Check-ins.
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.user import UserBrief


class DailyCheckInCreate(BaseModel):
    project_id: int
    completed_today: str = Field(..., min_length=1)
    working_on: str = Field(..., min_length=1)
    is_blocked: bool = False
    blocker_description: Optional[str] = None
    estimated_completion: Optional[str] = None
    notes: Optional[str] = None


class DailyCheckInResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    date: date
    completed_today: str
    working_on: str
    is_blocked: bool
    blocker_description: Optional[str] = None
    estimated_completion: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    user: Optional[UserBrief] = None

    model_config = {"from_attributes": True}
