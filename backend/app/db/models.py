import json
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float, Index
)
from sqlalchemy.orm import relationship
from backend.app.db.session import Base

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="DEVELOPER")  # ADMIN, PROJECT_MANAGER, DEVELOPER, TESTER, REPORTER
    avatar_url = Column(String(500), nullable=True)
    skills = Column(Text, default="[]")  # JSON list of skills / components
    active_status = Column(String(50), default="AVAILABLE")  # AVAILABLE, BUSY, AWAY
    is_verified = Column(Boolean, default=True)  # True for seeded/verified users
    verification_code = Column(String(10), nullable=True)  # 6-digit OTP
    verification_code_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    # Relationships
    assigned_bugs = relationship("Bug", back_populates="assignee", foreign_keys="Bug.assignee_id")
    reported_bugs = relationship("Bug", back_populates="reporter", foreign_keys="Bug.reporter_id")
    comments = relationship("Comment", back_populates="author")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    saved_searches = relationship("SavedSearch", back_populates="user", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(10), unique=True, index=True, nullable=False)  # e.g., NEXUS, PAY, ECOM, CLOUD
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    lead_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    components = Column(Text, default="[]")  # JSON list of component names
    environments = Column(Text, default='["Production", "Staging", "QA", "Development"]')
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    # Relationships
    bugs = relationship("Bug", back_populates="project", cascade="all, delete-orphan")


class Bug(Base):
    __tablename__ = "bugs"
    
    id = Column(Integer, primary_key=True, index=True)
    bug_key = Column(String(50), unique=True, index=True, nullable=False)  # e.g. PAY-101
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    
    title = Column(String(500), nullable=False, index=True)
    description = Column(Text, nullable=False)
    steps_to_reproduce = Column(Text, nullable=True)
    expected_behavior = Column(Text, nullable=True)
    actual_behavior = Column(Text, nullable=True)
    
    category = Column(String(100), default="General", index=True)
    component = Column(String(100), default="Core", index=True)
    severity = Column(String(50), default="MEDIUM", index=True)  # CRITICAL, HIGH, MEDIUM, LOW
    priority = Column(String(50), default="P3", index=True)     # P1, P2, P3, P4
    impact_score = Column(Integer, default=50)                  # 0 to 100
    
    status = Column(String(50), default="NEW", index=True)      
    # Workflow: NEW -> TRIAGED -> ASSIGNED -> IN_DEVELOPMENT -> CODE_REVIEW -> TESTING -> RESOLVED -> VERIFIED -> CLOSED (or REOPENED)
    
    environment = Column(String(100), default="Production")
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    labels = Column(Text, default="[]")  # JSON list
    is_security_sensitive = Column(Boolean, default=False)
    is_stale = Column(Boolean, default=False)
    
    # SLA Tracking
    sla_due_date = Column(DateTime, nullable=True)
    sla_breached = Column(Boolean, default=False)
    
    # Context & Quality
    technical_context = Column(Text, default="{}")  # JSON: browser, os, screen, user_agent, app_version
    quality_score = Column(Integer, default=70)      # 0 to 100
    
    # Timestamps
    created_at = Column(DateTime, default=utc_now, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, index=True)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    
    # Relationships
    project = relationship("Project", back_populates="bugs")
    reporter = relationship("User", foreign_keys=[reporter_id], back_populates="reported_bugs")
    assignee = relationship("User", foreign_keys=[assignee_id], back_populates="assigned_bugs")
    comments = relationship("Comment", back_populates="bug", cascade="all, delete-orphan", order_by="Comment.created_at.asc()")
    attachments = relationship("Attachment", back_populates="bug", cascade="all, delete-orphan")
    git_integrations = relationship("GitIntegration", back_populates="bug", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="bug", cascade="all, delete-orphan", order_by="AuditLog.timestamp.asc()")
    recommendations = relationship("AIRecommendation", back_populates="bug", cascade="all, delete-orphan")
    
    # Relationships to other bugs
    relations_as_source = relationship("BugRelation", foreign_keys="BugRelation.source_bug_id", back_populates="source_bug", cascade="all, delete-orphan")
    relations_as_target = relationship("BugRelation", foreign_keys="BugRelation.target_bug_id", back_populates="target_bug", cascade="all, delete-orphan")


class BugRelation(Base):
    __tablename__ = "bug_relations"
    
    id = Column(Integer, primary_key=True, index=True)
    source_bug_id = Column(Integer, ForeignKey("bugs.id"), nullable=False, index=True)
    target_bug_id = Column(Integer, ForeignKey("bugs.id"), nullable=False, index=True)
    relation_type = Column(String(50), nullable=False)  
    # BLOCKS, BLOCKED_BY, RELATED_TO, DUPLICATE_OF, PARENT_OF, CHILD_OF, REGRESSION_OF
    created_at = Column(DateTime, default=utc_now)
    
    source_bug = relationship("Bug", foreign_keys=[source_bug_id], back_populates="relations_as_source")
    target_bug = relationship("Bug", foreign_keys=[target_bug_id], back_populates="relations_as_target")


class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    bug_id = Column(Integer, ForeignKey("bugs.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("comments.id"), nullable=True)  # Nested replies
    content = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)
    edit_history = Column(Text, default="[]")  # JSON list of previous edits
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    bug = relationship("Bug", back_populates="comments")
    author = relationship("User", back_populates="comments")
    parent = relationship("Comment", remote_side=[id], backref="replies")


class Attachment(Base):
    __tablename__ = "attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    bug_id = Column(Integer, ForeignKey("bugs.id"), nullable=False, index=True)
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    content_type = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime, default=utc_now)
    
    bug = relationship("Bug", back_populates="attachments")
    uploader = relationship("User")


class GitIntegration(Base):
    __tablename__ = "git_integrations"
    
    id = Column(Integer, primary_key=True, index=True)
    bug_id = Column(Integer, ForeignKey("bugs.id"), nullable=False, index=True)
    branch_name = Column(String(255), nullable=True)
    commit_sha = Column(String(100), nullable=True)
    commit_message = Column(Text, nullable=True)
    pr_number = Column(Integer, nullable=True)
    pr_title = Column(String(255), nullable=True)
    pr_status = Column(String(50), default="OPEN")  # OPEN, REVIEW_REQUESTED, APPROVED, MERGED, CLOSED
    release_tag = Column(String(100), nullable=True)
    author = Column(String(100), nullable=True)
    url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    bug = relationship("Bug", back_populates="git_integrations")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    bug_id = Column(Integer, ForeignKey("bugs.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(255), default="System")
    action = Column(String(100), nullable=False)  # CREATED, STATUS_CHANGED, ASSIGNED, PRIORITY_CHANGED, GIT_EVENT, AI_TRIAGE, COMMENTED
    field_name = Column(String(100), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    
    bug = relationship("Bug", back_populates="audit_logs")


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # ASSIGNED, MENTIONED, PRIORITY_CHANGED, SLA_WARNING, PR_EVENT, VERIFY_REQUEST, REGRESSION_ALERT
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    bug_id = Column(Integer, nullable=True)
    bug_key = Column(String(50), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now, index=True)
    
    user = relationship("User", back_populates="notifications")


class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"
    
    id = Column(Integer, primary_key=True, index=True)
    bug_id = Column(Integer, ForeignKey("bugs.id"), nullable=True, index=True)
    recommendation_type = Column(String(50), nullable=False)  # TRIAGE, DUPLICATE, QUALITY, ASSIGNEE, REPRODUCTION_STEPS, PRIORITY, REGRESSION
    payload = Column(Text, nullable=False)  # JSON payload with details
    confidence_score = Column(Float, default=0.85)
    explanation = Column(Text, nullable=True)
    accepted_by_user = Column(Boolean, nullable=True)  # True, False, or None (pending)
    created_at = Column(DateTime, default=utc_now)
    
    bug = relationship("Bug", back_populates="recommendations")


class SavedSearch(Base):
    __tablename__ = "saved_searches"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    query = Column(String(500), nullable=True)
    filters_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=utc_now)
    
    user = relationship("User", back_populates="saved_searches")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(255), unique=True, index=True, nullable=False)
    raw_token_preview = Column(String(255), nullable=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    used_at = Column(DateTime, nullable=True)
    ip_address = Column(String(100), nullable=True)
    
    user = relationship("User")

