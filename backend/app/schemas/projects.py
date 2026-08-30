from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ProjectBase(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    components: Optional[List[str]] = []
    environments: Optional[List[str]] = ["Production", "Staging", "QA", "Development"]

class ProjectCreate(ProjectBase):
    lead_id: Optional[int] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    lead_id: Optional[int] = None
    components: Optional[List[str]] = None
    environments: Optional[List[str]] = None

class ProjectResponse(ProjectBase):
    id: int
    lead_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    bug_count: Optional[int] = 0
    open_bug_count: Optional[int] = 0
    critical_bug_count: Optional[int] = 0

    class Config:
        from_attributes = True
