"""
Pydantic schemas for Projects.
"""
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.user import UserBrief


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    key: str = Field(..., min_length=1, max_length=20)
    description: Optional[str] = None
    goal: Optional[str] = None
    status: str = Field(default="Active")  # Planning, Active, On Hold, Completed, Cancelled
    priority: str = Field(default="Medium")  # Low, Medium, High, Critical
    start_date: Optional[date] = None
    deadline: Optional[date] = None
    sprint_duration_weeks: Optional[int] = 2
    working_days: Optional[str] = "Mon-Fri"
    owner_id: Optional[int] = None


class ProjectCreate(ProjectBase):
    team_member_ids: Optional[List[int]] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    key: Optional[str] = Field(None, min_length=1, max_length=20)
    description: Optional[str] = None
    goal: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    start_date: Optional[date] = None
    deadline: Optional[date] = None
    sprint_duration_weeks: Optional[int] = None
    working_days: Optional[str] = None
    owner_id: Optional[int] = None


class ProjectStats(BaseModel):
    total_tasks: int = 0
    completed_tasks: int = 0
    in_progress_tasks: int = 0
    blocked_tasks: int = 0
    overdue_tasks: int = 0
    total_story_points: int = 0
    completed_story_points: int = 0
    progress_percentage: float = 0.0
    active_sprints_count: int = 0
    total_sprints_count: int = 0
    team_members_count: int = 0
    risks_count: int = 0
    health_score: int = 100
    today_progress_change: float = 0.0
    yesterday_progress: float = 0.0
    seven_day_progress_change: float = 0.0


class ProjectResponse(ProjectBase):
    id: int
    progress: float
    created_at: datetime
    updated_at: datetime
    owner: Optional[UserBrief] = None
    stats: Optional[ProjectStats] = None
    current_user_role: Optional[str] = "OWNER"

    model_config = {"from_attributes": True}


class ProjectBrief(BaseModel):
    id: int
    name: str
    key: str
    status: str
    priority: str

    model_config = {"from_attributes": True}
