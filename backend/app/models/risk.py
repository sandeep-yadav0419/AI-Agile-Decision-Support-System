"""
Risk ORM model.
"""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Risk(Base):
    __tablename__ = "risks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    risk_type = Column(String(100), nullable=False)  # Overdue Task, Blocked Task, Sprint Delay, Workload Overload, Scope Creep, Low Velocity
    severity = Column(String(20), nullable=False, default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    description = Column(Text, nullable=False)
    mitigation = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="Active")  # Active, Mitigated, Resolved, Dismissed
    detected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="risks")
    sprint = relationship("Sprint", back_populates="risks")
    task = relationship("Task", back_populates="risks")
