"""
DailyProjectSnapshot ORM model for daily agile telemetry and historical analytics.
"""
from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class DailyProjectSnapshot(Base):
    __tablename__ = "daily_project_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    progress_percentage = Column(Float, default=0.0)
    completed_tasks = Column(Integer, default=0)
    open_tasks = Column(Integer, default=0)
    blocked_tasks = Column(Integer, default=0)
    overdue_tasks = Column(Integer, default=0)
    completed_story_points = Column(Integer, default=0)
    remaining_story_points = Column(Integer, default=0)
    total_story_points = Column(Integer, default=0)
    active_members = Column(Integer, default=0)
    velocity = Column(Float, default=0.0)
    health_score = Column(Integer, default=80)
    risk_score = Column(Integer, default=20)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="daily_snapshots")
