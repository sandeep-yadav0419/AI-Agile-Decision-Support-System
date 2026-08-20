"""
Pydantic schemas for AI Decision Engine and Health Analysis.
"""
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel

from app.schemas.recommendation import RecommendationResponse
from app.schemas.risk import RiskResponse


class MetricScore(BaseModel):
    name: str
    score: int  # 0-100
    weight: float
    status: str  # optimal, warning, critical
    details: str


class SprintHealthAnalysis(BaseModel):
    sprint_id: int
    sprint_name: str
    project_id: int
    project_name: str
    health_score: int  # 0-100
    delivery_risk: str  # LOW, MEDIUM, HIGH, CRITICAL
    delay_probability: int  # 0-100%
    workload_risk: str  # LOW, MEDIUM, HIGH, CRITICAL
    scope_risk: str  # LOW, MEDIUM, HIGH, CRITICAL
    deadline_risk: str  # LOW, MEDIUM, HIGH, CRITICAL
    summary_reason: str
    primary_recommendation: str
    metric_breakdown: List[MetricScore] = []
    active_risks_count: int = 0
    pending_recommendations_count: int = 0


class DeliveryForecast(BaseModel):
    project_id: int
    project_name: str
    total_story_points: int
    completed_points: int
    remaining_points: int
    current_velocity_per_week: float
    required_velocity_per_week: float
    estimated_weeks_remaining: float
    target_deadline: Optional[date] = None
    expected_completion_date: Optional[date] = None
    delivery_confidence: int  # 0-100%
    delay_probability: int  # 0-100%
    is_at_risk: bool
    forecast_summary: str


class ProjectHealthSummary(BaseModel):
    project_id: int
    project_name: str
    overall_health_score: int  # 0-100
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    delivery_risk: Optional[str] = None
    reason: Optional[str] = None
    active_sprint: Optional[SprintHealthAnalysis] = None
    forecast: Optional[DeliveryForecast] = None
    critical_risks: List[RiskResponse] = []
    top_recommendations: List[RecommendationResponse] = []
    analysis_timestamp: datetime


class AIAnalysisOverview(BaseModel):
    overall_system_health: int
    total_projects_monitored: int
    active_sprints_monitored: int
    high_priority_risks_count: int
    pending_recommendations_count: int
    project_summaries: List[ProjectHealthSummary] = []
    latest_risks: List[RiskResponse] = []
    latest_recommendations: List[RecommendationResponse] = []
    generated_at: datetime
