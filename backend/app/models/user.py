"""
User ORM model.
"""
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="Developer")  # "Project Manager", "Developer", "Designer", "QA Engineer", "Business Analyst", "Scrum Master"
    auth_provider = Column(String, nullable=False, default="local")  # "local", "google", "github"
    google_sub = Column(String, nullable=True, index=True)
    github_id = Column(String, nullable=True, index=True)
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    # Security & MFA Attributes
    is_mfa_enabled = Column(Boolean, nullable=False, default=False)
    mfa_secret = Column(String, nullable=True)
    mfa_recovery_codes = Column(Text, nullable=True)  # JSON string of SHA-256 hashed recovery codes
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    lockout_until = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    created_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assignee_id")
    team_memberships = relationship("TeamMember", back_populates="user", cascade="all, delete-orphan")
    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan", order_by="Notification.id.desc()")
    audit_logs = relationship("SecurityAuditLog", back_populates="user", cascade="all, delete-orphan", order_by="SecurityAuditLog.id.desc()")
