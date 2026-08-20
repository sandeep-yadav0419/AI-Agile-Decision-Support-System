"""
Pydantic schemas for Risks.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.project import ProjectBrief


class RiskBase(BaseModel):
    project_id: int
    sprint_id: Optional[int] = None
    task_id: Optional[int] = None
    risk_type: str = Field(..., min_length=1, max_length=100)
    severity: str = Field(default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    description: str = Field(..., min_length=1)
    mitigation: Optional[str] = None
    status: str = Field(default="Active")  # Active, Mitigated, Resolved, Dismissed


class RiskCreate(RiskBase):
    pass


class RiskUpdate(BaseModel):
    risk_type: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    mitigation: Optional[str] = None
    status: Optional[str] = None


class RiskResponse(RiskBase):
    id: int
    detected_at: datetime
    project: Optional[ProjectBrief] = None
    task_title: Optional[str] = None
    sprint_name: Optional[str] = None

    model_config = {"from_attributes": True}
