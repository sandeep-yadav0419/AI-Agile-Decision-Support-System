"""
Pydantic schemas for Reports and Analytics.
"""
from typing import Dict, List, Optional
from pydantic import BaseModel

from app.schemas.sprint import BurndownPoint


class VelocityDataPoint(BaseModel):
    sprint_id: int
    sprint_name: str
    target_velocity: int
    completed_points: int
    committed_points: int


class StatusDistribution(BaseModel):
    status: str
    count: int
    points: int
    percentage: float


class PriorityDistribution(BaseModel):
    priority: str
    count: int
    percentage: float


class MemberWorkloadDistribution(BaseModel):
    user_id: int
    name: str
    role: str
    points: int
    task_count: int
    status: str


class RiskSeverityDistribution(BaseModel):
    severity: str
    count: int
    active_count: int


class CategoryRecommendationCount(BaseModel):
    category: str
    total: int
    accepted: int
    pending: int


class ReportsSummary(BaseModel):
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    total_projects: int = 0
    total_sprints: int = 0
    total_tasks: int = 0
    completed_tasks: int = 0
    total_points: int = 0
    completed_points: int = 0
    completion_rate: float = 0.0
    average_velocity: float = 0.0
    overall_health_score: int = 100
    status_distribution: List[StatusDistribution] = []
    priority_distribution: List[PriorityDistribution] = []
    velocity_history: List[VelocityDataPoint] = []
    burndown: List[BurndownPoint] = []
    workload_distribution: List[MemberWorkloadDistribution] = []
    risk_distribution: List[RiskSeverityDistribution] = []
    recommendation_distribution: List[CategoryRecommendationCount] = []
