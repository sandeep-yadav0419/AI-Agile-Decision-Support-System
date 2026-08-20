"""
Pydantic schemas for Team Members and Workload.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserBrief


class TeamMemberCreate(BaseModel):
    user_id: Optional[int] = None
    # Or create a new user directly:
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: str = Field(default="Developer")
    project_id: Optional[int] = None


class TeamMemberResponse(BaseModel):
    id: int
    project_id: Optional[int] = None
    user_id: int
    role: str
    joined_at: datetime
    user: Optional[UserBrief] = None

    model_config = {"from_attributes": True}


class MemberWorkloadResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: str
    assigned_tasks_count: int
    in_progress_tasks_count: int
    completed_tasks_count: int
    blocked_tasks_count: int
    total_story_points: int
    in_progress_points: int
    workload_status: str  # "Low Workload", "Normal Workload", "High Workload", "Overloaded"
    utilization_percentage: int
    active_projects: List[str] = []
