import re
import json
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.app.db.session import get_db
from backend.app.db.models import Comment, Bug, User, Notification
from backend.app.schemas.comments import CommentCreate, CommentUpdate, CommentResponse
from backend.app.schemas.bugs import UserBrief
from backend.app.services.workflow_service import workflow_service
from backend.app.api.auth import get_current_user
from backend.app.api.websockets import ws_manager

router = APIRouter(tags=["Threaded Comments & Collaboration"])

def format_single_comment(comment: Comment, replies: Optional[List[CommentResponse]] = None) -> CommentResponse:
    author_brief = None
    if comment.author:
        author_brief = UserBrief(
            id=comment.author.id,
            full_name=comment.author.full_name,
            email=comment.author.email,
            role=comment.author.role,
            avatar_url=comment.author.avatar_url
        )
        
    edit_hist = json.loads(comment.edit_history) if isinstance(comment.edit_history, str) else (comment.edit_history or [])
    
    return CommentResponse(
        id=comment.id,
        bug_id=comment.bug_id,
        author_id=comment.author_id,
        parent_id=comment.parent_id,
        content=comment.content,
        is_resolved=comment.is_resolved,
        edit_history=edit_hist,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author=author_brief,
        replies=replies or []
    )

def build_comment_hierarchy(comments: List[Comment]) -> List[CommentResponse]:
    by_id = {}
    replies_map = {}
    
    for c in comments:
        resp = format_single_comment(c)
        by_id[c.id] = resp
        if c.parent_id:
            replies_map.setdefault(c.parent_id, []).append(resp)

    roots = []
    for c in comments:
        resp = by_id[c.id]
        resp.replies = replies_map.get(c.id, [])
        if c.parent_id is None:
            roots.append(resp)
            
    return roots

@router.get("/bugs/{bug_id}/comments", response_model=List[CommentResponse])
async def get_bug_comments(
    bug_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Comment).options(
        selectinload(Comment.author)
    ).filter(
        Comment.bug_id == bug_id
    ).order_by(Comment.created_at.asc())
    
    result = await db.execute(query)
    all_comments = result.scalars().all()
    return build_comment_hierarchy(all_comments)

@router.post("/bugs/{bug_id}/comments", response_model=CommentResponse)
async def create_comment(
    bug_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    bug_res = await db.execute(select(Bug).filter(Bug.id == bug_id))
    bug = bug_res.scalars().first()
    if not bug:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug not found")
        
    comment = Comment(
        bug_id=bug_id,
        author_id=current_user.id,
        parent_id=comment_data.parent_id,
        content=comment_data.content,
        is_resolved=False,
        edit_history="[]"
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    
    # Audit log
    await workflow_service.record_audit_log(
        session=db,
        bug_id=bug.id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        action="COMMENTED",
        field_name="comments",
        old_value=None,
        new_value=comment.content[:60] + ("..." if len(comment.content) > 60 else ""),
        reason="Thread reply" if comment_data.parent_id else "New discussion note"
    )
    
    # Parse @mentions (e.g. @Rahul, @Sarah) to send notifications
    mentions = re.findall(r"@(\w+)", comment_data.content)
    for m in mentions:
        user_res = await db.execute(select(User).filter(User.full_name.ilike(f"%{m}%")))
        mentioned_user = user_res.scalars().first()
        if mentioned_user and mentioned_user.id != current_user.id:
            await workflow_service.create_notification(
                session=db,
                user_id=mentioned_user.id,
                type="MENTIONED",
                title=f"{current_user.full_name} mentioned you on {bug.bug_key}",
                message=comment_data.content[:140],
                bug_id=bug.id,
                bug_key=bug.bug_key
            )
            
    # Also notify bug assignee if different from author
    if bug.assignee_id and bug.assignee_id != current_user.id:
        await workflow_service.create_notification(
            session=db,
            user_id=bug.assignee_id,
            type="COMMENTED",
            title=f"New comment on {bug.bug_key}",
            message=f"{current_user.full_name}: {comment_data.content[:100]}",
            bug_id=bug.id,
            bug_key=bug.bug_key
        )
        
    await db.commit()
    
    try:
        await ws_manager.broadcast({
            "type": "NEW_COMMENT",
            "bug_id": bug.id,
            "bug_key": bug.bug_key,
            "author": current_user.full_name,
            "content": comment_data.content[:80] + ("..." if len(comment_data.content) > 80 else ""),
            "message": f"{current_user.full_name} commented on {bug.bug_key}: \"{comment_data.content[:60]}\""
        })
    except Exception:
        pass
        
    # Reload with author
    reload_query = select(Comment).options(
        selectinload(Comment.author)
    ).filter(Comment.id == comment.id)
    res = await db.execute(reload_query)
    c_loaded = res.scalars().first()
    return format_single_comment(c_loaded)

@router.patch("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: int,
    comment_update: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Comment).options(
        selectinload(Comment.author)
    ).filter(Comment.id == comment_id)
    result = await db.execute(query)
    comment = result.scalars().first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        
    now = datetime.now(timezone.utc)
    
    if comment_update.content is not None and comment_update.content != comment.content:
        # Check permissions: only author can edit content
        if comment.author_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another user's comment")
            
        history = json.loads(comment.edit_history) if isinstance(comment.edit_history, str) else (comment.edit_history or [])
        history.append({
            "previous_content": comment.content,
            "edited_at": now.isoformat(),
            "edited_by": current_user.full_name
        })
        comment.edit_history = json.dumps(history)
        comment.content = comment_update.content
        comment.updated_at = now
        
    if comment_update.is_resolved is not None:
        comment.is_resolved = comment_update.is_resolved
        comment.updated_at = now
        
    await db.commit()
    await db.refresh(comment)
    return format_single_comment(comment)
