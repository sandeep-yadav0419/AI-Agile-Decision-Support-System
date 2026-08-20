"""
Pydantic schemas for Sprints.
"""
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.project import ProjectBrief


class SprintBase(BaseModel):
    project_id: int
    name: str = Field(..., min_length=1, max_length=150)
    goal: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str = Field(default="Planned")  # Planned, Active, Completed
    velocity_target: int = Field(default=20, ge=1)


class SprintCreate(SprintBase):
    pass


class SprintUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    goal: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    velocity_target: Optional[int] = Field(None, ge=1)
    completed_points: Optional[int] = None


class BurndownPoint(BaseModel):
    day: str
    date: str
    ideal_points: float
    actual_points: Optional[float] = None


class SprintHealthSummary(BaseModel):
    health_score: int
    delivery_risk: str  # LOW, MEDIUM, HIGH, CRITICAL
    delay_probability: int  # 0 - 100%
    reason: str
    recommendation: str


class SprintStats(BaseModel):
    total_tasks: int = 0
    completed_tasks: int = 0
    in_progress_tasks: int = 0
    blocked_tasks: int = 0
    overdue_tasks: int = 0
    total_points: int = 0
    completed_points: int = 0
    remaining_points: int = 0
    completion_percentage: float = 0.0
    elapsed_days: int = 0
    total_days: int = 14
    time_progress_percentage: float = 0.0
    health: Optional[SprintHealthSummary] = None


class SprintResponse(SprintBase):
    id: int
    completed_points: int
    created_at: datetime
    updated_at: datetime
    project: Optional[ProjectBrief] = None
    stats: Optional[SprintStats] = None

    model_config = {"from_attributes": True}
