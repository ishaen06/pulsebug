from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from backend.app.schemas.bugs import UserBrief

class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[int] = None

class CommentUpdate(BaseModel):
    content: Optional[str] = None
    is_resolved: Optional[bool] = None

class CommentResponse(BaseModel):
    id: int
    bug_id: int
    author_id: int
    parent_id: Optional[int] = None
    content: str
    is_resolved: bool
    edit_history: Optional[List[Any]] = []
    created_at: datetime
    updated_at: datetime
    author: Optional[UserBrief] = None
    replies: Optional[List["CommentResponse"]] = []

    class Config:
        from_attributes = True

CommentResponse.model_rebuild()
