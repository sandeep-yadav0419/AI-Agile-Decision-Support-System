"""
Project ORM model.
"""
from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    key = Column(String(20), nullable=False, index=True)
    description = Column(Text, nullable=True)
    goal = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="Active")  # Planning, Active, On Hold, Completed, Cancelled
    priority = Column(String(20), nullable=False, default="Medium")  # Low, Medium, High, Critical
    start_date = Column(Date, nullable=True)
    deadline = Column(Date, nullable=True)
    sprint_duration_weeks = Column(Integer, default=2)
    working_days = Column(String(50), default="Mon-Fri")
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    progress = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    owner = relationship("User", back_populates="created_projects", foreign_keys=[owner_id])
    sprints = relationship("Sprint", back_populates="project", cascade="all, delete-orphan", order_by="Sprint.id.desc()")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    team_members = relationship("TeamMember", back_populates="project", cascade="all, delete-orphan")
    risks = relationship("Risk", back_populates="project", cascade="all, delete-orphan", order_by="Risk.id.desc()")
    recommendations = relationship("DecisionRecommendation", back_populates="project", cascade="all, delete-orphan", order_by="DecisionRecommendation.id.desc()")
    daily_snapshots = relationship("DailyProjectSnapshot", back_populates="project", cascade="all, delete-orphan", order_by="DailyProjectSnapshot.date.desc()")
    activities = relationship("ActivityLog", back_populates="project", cascade="all, delete-orphan", order_by="ActivityLog.id.desc()")
    checkins = relationship("DailyCheckIn", back_populates="project", cascade="all, delete-orphan", order_by="DailyCheckIn.id.desc()")
