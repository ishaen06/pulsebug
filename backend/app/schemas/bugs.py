from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class TechnicalContext(BaseModel):
    browser: Optional[str] = None
    os: Optional[str] = None
    screen_resolution: Optional[str] = None
    device: Optional[str] = None
    app_version: Optional[str] = None
    user_agent: Optional[str] = None

class BugBase(BaseModel):
    title: str
    description: str
    steps_to_reproduce: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    category: Optional[str] = "General"
    component: Optional[str] = "Core"
    severity: Optional[str] = "MEDIUM"  # CRITICAL, HIGH, MEDIUM, LOW
    priority: Optional[str] = "P3"     # P1, P2, P3, P4
    environment: Optional[str] = "Production"
    labels: Optional[List[str]] = []
    is_security_sensitive: Optional[bool] = False
    technical_context: Optional[Dict[str, Any]] = {}

class BugCreate(BugBase):
    project_id: int
    assignee_id: Optional[int] = None
    quality_score: Optional[int] = 70
    impact_score: Optional[int] = 50

class BugUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    steps_to_reproduce: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    category: Optional[str] = None
    component: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assignee_id: Optional[int] = None
    environment: Optional[str] = None
    labels: Optional[List[str]] = None
    is_security_sensitive: Optional[bool] = None
    is_stale: Optional[bool] = None
    impact_score: Optional[int] = None
    quality_score: Optional[int] = None
    reason: Optional[str] = None  # Reason for audit log

class BugRelationCreate(BaseModel):
    target_bug_id: int
    relation_type: str  # BLOCKS, BLOCKED_BY, RELATED_TO, DUPLICATE_OF, PARENT_OF, CHILD_OF, REGRESSION_OF

class BugRelationResponse(BaseModel):
    id: int
    source_bug_id: int
    target_bug_id: int
    relation_type: str
    target_bug_key: Optional[str] = None
    target_bug_title: Optional[str] = None
    target_bug_status: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AuditLogResponse(BaseModel):
    id: int
    bug_id: int
    user_id: Optional[int] = None
    user_name: str
    action: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class GitIntegrationItem(BaseModel):
    id: int
    branch_name: Optional[str] = None
    commit_sha: Optional[str] = None
    commit_message: Optional[str] = None
    pr_number: Optional[int] = None
    pr_title: Optional[str] = None
    pr_status: Optional[str] = None
    release_tag: Optional[str] = None
    author: Optional[str] = None
    url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserBrief(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

class BugResponse(BugBase):
    id: int
    bug_key: str
    project_id: int
    impact_score: int
    status: str
    reporter_id: int
    assignee_id: Optional[int] = None
    is_stale: bool
    sla_due_date: Optional[datetime] = None
    sla_breached: bool
    quality_score: int
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    
    reporter: Optional[UserBrief] = None
    assignee: Optional[UserBrief] = None
    comments_count: Optional[int] = 0
    attachments_count: Optional[int] = 0
    git_links_count: Optional[int] = 0
    sla_hours_remaining: Optional[float] = None
    sla_percentage: Optional[int] = 100
    age_days: Optional[int] = 0

    class Config:
        from_attributes = True

class BugDetailResponse(BugResponse):
    relations: Optional[List[BugRelationResponse]] = []
    git_integrations: Optional[List[GitIntegrationItem]] = []
    audit_logs: Optional[List[AuditLogResponse]] = []
