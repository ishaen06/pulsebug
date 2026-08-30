import os
import shutil
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.config import settings
from backend.app.db.session import get_db
from backend.app.db.models import Attachment, Bug, User
from backend.app.services.workflow_service import workflow_service
from backend.app.api.auth import get_current_user

router = APIRouter(tags=["File Attachments"])

@router.post("/bugs/{bug_id}/attachments")
async def upload_attachment(
    bug_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    bug_res = await db.execute(select(Bug).filter(Bug.id == bug_id))
    bug = bug_res.scalars().first()
    if not bug:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug not found")
        
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    file_uuid = uuid.uuid4().hex[:10]
    safe_filename = f"{file_uuid}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_size = os.path.getsize(file_path)
    
    attachment = Attachment(
        bug_id=bug.id,
        uploader_id=current_user.id,
        file_name=file.filename,
        file_path=file_path,
        file_size=file_size,
        content_type=file.content_type or "application/octet-stream"
    )
    db.add(attachment)
    
    await workflow_service.record_audit_log(
        session=db,
        bug_id=bug.id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        action="ATTACHMENT_ADDED",
        field_name="attachment",
        old_value=None,
        new_value=file.filename,
        reason="Uploaded log/screenshot asset"
    )
    
    await db.commit()
    await db.refresh(attachment)
    
    return {
        "id": attachment.id,
        "bug_id": attachment.bug_id,
        "file_name": attachment.file_name,
        "file_size": attachment.file_size,
        "content_type": attachment.content_type,
        "uploaded_at": attachment.uploaded_at.isoformat()
    }

@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Attachment).filter(Attachment.id == attachment_id))
    att = res.scalars().first()
    if not att or not os.path.exists(att.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File attachment not found")
        
    return FileResponse(
        path=att.file_path,
        filename=att.file_name,
        media_type=att.content_type
    )
