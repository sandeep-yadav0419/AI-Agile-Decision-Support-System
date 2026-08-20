"""
DecisionRecommendation ORM model.
"""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class DecisionRecommendation(Base):
    __tablename__ = "decision_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False, default="Schedule")  # Schedule, Resource, Scope, Technical, Quality, Team
    priority = Column(String(20), nullable=False, default="Medium")  # Low, Medium, High, Critical
    reason = Column(Text, nullable=False)
    action_text = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="pending")  # pending, reviewed, accepted, dismissed
    impact_score = Column(Integer, default=75, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="recommendations")
    sprint = relationship("Sprint", back_populates="recommendations")
