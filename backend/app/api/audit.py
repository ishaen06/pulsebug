from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from backend.app.db.session import get_db
from backend.app.db.models import AuditLog, User
from backend.app.schemas.bugs import AuditLogResponse
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit Log & Governance"])

@router.get("/recent", response_model=List[AuditLogResponse])
async def list_recent_audit_logs(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit))
    return result.scalars().all()

@router.get("/bug/{bug_id}", response_model=List[AuditLogResponse])
async def list_bug_audit_logs(
    bug_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditLog)
        .filter(AuditLog.bug_id == bug_id)
        .order_by(desc(AuditLog.timestamp))
    )
    return result.scalars().all()
