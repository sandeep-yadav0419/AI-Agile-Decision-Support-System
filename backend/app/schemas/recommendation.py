"""
Pydantic schemas for Decision Recommendations.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.project import ProjectBrief


class RecommendationBase(BaseModel):
    project_id: int
    sprint_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=255)
    category: str = Field(default="Schedule")  # Schedule, Resource, Scope, Technical, Quality, Team
    priority: str = Field(default="Medium")  # Low, Medium, High, Critical
    reason: str = Field(..., min_length=1)
    action_text: str = Field(..., min_length=1)
    status: str = Field(default="pending")  # pending, reviewed, accepted, dismissed
    impact_score: int = Field(default=75, ge=1, le=100)


class RecommendationCreate(RecommendationBase):
    pass


class RecommendationStatusUpdate(BaseModel):
    status: str = Field(..., description="pending, reviewed, accepted, dismissed")


class RecommendationResponse(RecommendationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    project: Optional[ProjectBrief] = None
    sprint_name: Optional[str] = None

    model_config = {"from_attributes": True}
