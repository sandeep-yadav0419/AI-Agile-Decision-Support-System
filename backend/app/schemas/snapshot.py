"""
Pydantic schemas for Daily Project Snapshots.
"""
from datetime import date, datetime
from pydantic import BaseModel


class DailyProjectSnapshotResponse(BaseModel):
    id: int
    project_id: int
    date: date
    progress_percentage: float
    completed_tasks: int
    open_tasks: int
    blocked_tasks: int
    overdue_tasks: int
    completed_story_points: int
    remaining_story_points: int
    total_story_points: int
    active_members: int
    velocity: float
    health_score: int
    risk_score: int
    created_at: datetime

    model_config = {"from_attributes": True}
