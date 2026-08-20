"""
Pydantic schemas for Tasks.
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.project import ProjectBrief
from app.schemas.user import UserBrief


class SprintBrief(BaseModel):
    id: int
    name: str
    status: str

    model_config = {"from_attributes": True}


class TaskBase(BaseModel):
    project_id: int
    sprint_id: Optional[int] = None
    assignee_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    priority: str = Field(default="Medium")  # Low, Medium, High, Critical
    status: str = Field(default="To Do")  # Backlog, To Do, In Progress, Review, Done, Blocked
    story_points: int = Field(default=3, ge=0)
    due_date: Optional[date] = None
    position: Optional[int] = 0


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    project_id: Optional[int] = None
    sprint_id: Optional[int] = None
    assignee_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    story_points: Optional[int] = Field(None, ge=0)
    due_date: Optional[date] = None
    position: Optional[int] = None


class TaskStatusUpdate(BaseModel):
    status: str = Field(..., description="Backlog, To Do, In Progress, Review, Done, Blocked")
    position: Optional[int] = None


class TaskResponse(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime
    project: Optional[ProjectBrief] = None
    sprint: Optional[SprintBrief] = None
    assignee: Optional[UserBrief] = None
    is_overdue: Optional[bool] = False
    has_risk: Optional[bool] = False

    model_config = {"from_attributes": True}
