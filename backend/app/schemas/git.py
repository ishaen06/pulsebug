from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class GitEventSimulateRequest(BaseModel):
    event_type: str  # "branch_created", "commit_pushed", "pr_opened", "pr_review_approved", "pr_merged", "release_tagged"
    branch_name: Optional[str] = None
    commit_sha: Optional[str] = None
    commit_message: Optional[str] = None
    pr_number: Optional[int] = None
    pr_title: Optional[str] = None
    release_tag: Optional[str] = None
    author: Optional[str] = "developer"

class GitIntegrationCreate(BaseModel):
    branch_name: Optional[str] = None
    commit_sha: Optional[str] = None
    commit_message: Optional[str] = None
    pr_number: Optional[int] = None
    pr_title: Optional[str] = None
    pr_status: Optional[str] = "OPEN"
    release_tag: Optional[str] = None
    author: Optional[str] = None
    url: Optional[str] = None

class GitIntegrationResponse(GitIntegrationCreate):
    id: int
    bug_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class GitEventSimulateResponse(BaseModel):
    success: bool
    event_type: str
    bug_id: int
    bug_key: str
    previous_status: str
    new_status: str
    message: str
    git_integration: Optional[GitIntegrationResponse] = None
