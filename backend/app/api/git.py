from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.db.session import get_db
from backend.app.db.models import Bug, GitIntegration, User
from backend.app.schemas.git import GitEventSimulateRequest, GitEventSimulateResponse, GitIntegrationResponse
from backend.app.services.git_service import git_service
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/git", tags=["GitHub & Development Integration"])

@router.post("/simulate/{bug_id}", response_model=GitEventSimulateResponse)
async def simulate_git_event(
    bug_id: int,
    req: GitEventSimulateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Simulates a GitHub development lifecycle event:
    - branch_created -> IN_DEVELOPMENT
    - commit_pushed  -> IN_DEVELOPMENT
    - pr_opened      -> CODE_REVIEW
    - pr_review_approved -> CODE_REVIEW (Approved)
    - pr_merged      -> TESTING
    - release_tagged -> VERIFIED
    """
    res = await db.execute(select(Bug).filter(Bug.id == bug_id))
    bug = res.scalars().first()
    if not bug:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug not found")
        
    success, prev_status, new_status, msg, git_record = await git_service.simulate_git_event(
        session=db,
        bug=bug,
        event_type=req.event_type,
        user_name=current_user.full_name,
        user_id=current_user.id,
        custom_branch=req.branch_name,
        custom_pr_num=req.pr_number
    )
    
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        
    await db.commit()
    if git_record:
        await db.refresh(git_record)
        
    git_resp = None
    if git_record:
        git_resp = GitIntegrationResponse(
            id=git_record.id,
            bug_id=git_record.bug_id,
            branch_name=git_record.branch_name,
            commit_sha=git_record.commit_sha,
            commit_message=git_record.commit_message,
            pr_number=git_record.pr_number,
            pr_title=git_record.pr_title,
            pr_status=git_record.pr_status,
            release_tag=git_record.release_tag,
            author=git_record.author,
            url=git_record.url,
            created_at=git_record.created_at,
            updated_at=git_record.updated_at
        )
        
    return GitEventSimulateResponse(
        success=True,
        event_type=req.event_type,
        bug_id=bug.id,
        bug_key=bug.bug_key,
        previous_status=prev_status,
        new_status=new_status,
        message=msg,
        git_integration=git_resp
    )

@router.get("/bug/{bug_id}", response_model=List[GitIntegrationResponse])
async def get_bug_git_integrations(
    bug_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(GitIntegration).filter(GitIntegration.bug_id == bug_id).order_by(GitIntegration.created_at.desc()))
    items = res.scalars().all()
    return items
