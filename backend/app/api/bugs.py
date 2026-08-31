import json
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, desc
from sqlalchemy.orm import selectinload

from backend.app.db.session import get_db
from backend.app.db.models import (
    Bug, Project, User, BugRelation, Comment, Attachment, GitIntegration, AuditLog, Notification, AIRecommendation
)
from backend.app.schemas.bugs import (
    BugCreate, BugUpdate, BugResponse, BugDetailResponse, BugRelationCreate, BugRelationResponse,
    AuditLogResponse, GitIntegrationItem, UserBrief
)
from backend.app.services.sla_service import calculate_sla_due_date, evaluate_sla_status
from backend.app.services.workflow_service import workflow_service
from backend.app.services.ai_service import ai_service
from backend.app.api.auth import get_current_user
from backend.app.api.websockets import ws_manager

router = APIRouter(prefix="/bugs", tags=["Bugs & Issues Management"])

def _format_bug_response(bug: Bug) -> BugResponse:
    sla_info = evaluate_sla_status(bug.created_at, bug.sla_due_date, bug.status, bug.resolved_at)
    
    labels_list = json.loads(bug.labels) if isinstance(bug.labels, str) else (bug.labels or [])
    tech_ctx = json.loads(bug.technical_context) if isinstance(bug.technical_context, str) else (bug.technical_context or {})
    
    reporter_brief = None
    if bug.reporter:
        reporter_brief = UserBrief(
            id=bug.reporter.id,
            full_name=bug.reporter.full_name,
            email=bug.reporter.email,
            role=bug.reporter.role,
            avatar_url=bug.reporter.avatar_url
        )
        
    assignee_brief = None
    if bug.assignee:
        assignee_brief = UserBrief(
            id=bug.assignee.id,
            full_name=bug.assignee.full_name,
            email=bug.assignee.email,
            role=bug.assignee.role,
            avatar_url=bug.assignee.avatar_url
        )
        
    return BugResponse(
        id=bug.id,
        bug_key=bug.bug_key,
        project_id=bug.project_id,
        title=bug.title,
        description=bug.description,
        steps_to_reproduce=bug.steps_to_reproduce,
        expected_behavior=bug.expected_behavior,
        actual_behavior=bug.actual_behavior,
        category=bug.category,
        component=bug.component,
        severity=bug.severity,
        priority=bug.priority,
        impact_score=bug.impact_score,
        status=bug.status,
        environment=bug.environment,
        reporter_id=bug.reporter_id,
        assignee_id=bug.assignee_id,
        labels=labels_list,
        is_security_sensitive=bug.is_security_sensitive,
        is_stale=sla_info["is_stale"],
        sla_due_date=bug.sla_due_date,
        sla_breached=sla_info["sla_breached"],
        technical_context=tech_ctx,
        quality_score=bug.quality_score,
        created_at=bug.created_at,
        updated_at=bug.updated_at,
        resolved_at=bug.resolved_at,
        closed_at=bug.closed_at,
        reporter=reporter_brief,
        assignee=assignee_brief,
        comments_count=len(bug.comments) if hasattr(bug, "comments") and bug.comments else 0,
        attachments_count=len(bug.attachments) if hasattr(bug, "attachments") and bug.attachments else 0,
        git_links_count=len(bug.git_integrations) if hasattr(bug, "git_integrations") and bug.git_integrations else 0,
        sla_hours_remaining=sla_info["sla_hours_remaining"],
        sla_percentage=sla_info["sla_percentage"],
        age_days=sla_info["age_days"]
    )

@router.get("", response_model=List[BugResponse])
async def list_bugs(
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    component: Optional[str] = None,
    assignee_id: Optional[int] = None,
    assignee_name: Optional[str] = None,
    reporter_id: Optional[int] = None,
    is_stale: Optional[bool] = None,
    sla_breached: Optional[bool] = None,
    min_overdue_days: Optional[int] = None,
    min_overdue_hours: Optional[int] = None,
    is_security_sensitive: Optional[bool] = None,
    min_impact_score: Optional[int] = None,
    q: Optional[str] = None,
    days_back: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Bug).options(
        selectinload(Bug.reporter),
        selectinload(Bug.assignee),
        selectinload(Bug.comments),
        selectinload(Bug.attachments),
        selectinload(Bug.git_integrations)
    )
    
    # Filter conditions
    conditions = []
    
    # Restrict security-sensitive bugs if user is standard reporter/guest unless they reported it
    if current_user.role == "REPORTER":
        conditions.append(or_(Bug.is_security_sensitive == False, Bug.reporter_id == current_user.id))
        
    if project_id:
        conditions.append(Bug.project_id == project_id)
    if status:
        if status.upper() == "OPEN":
            conditions.append(Bug.status.notin_(["RESOLVED", "VERIFIED", "CLOSED"]))
        else:
            conditions.append(Bug.status == status.upper())
    if priority:
        conditions.append(Bug.priority == priority.upper())
    if severity:
        conditions.append(Bug.severity == severity.upper())
    if category:
        conditions.append(Bug.category.ilike(f"%{category}%"))
    if component:
        conditions.append(Bug.component.ilike(f"%{component}%"))
    if assignee_id:
        conditions.append(Bug.assignee_id == assignee_id)
    if assignee_name:
        conditions.append(Bug.assignee.has(User.full_name.ilike(f"%{assignee_name}%")))
    if reporter_id:
        conditions.append(Bug.reporter_id == reporter_id)
    if is_stale is not None:
        conditions.append(Bug.is_stale == is_stale)
        
    # Precise SLA duration filtering
    now_utc = datetime.now(timezone.utc)
    if min_overdue_days is not None and min_overdue_days > 0:
        overdue_threshold = now_utc - timedelta(days=min_overdue_days)
        conditions.append(and_(
            Bug.sla_due_date <= overdue_threshold,
            Bug.status.notin_(["RESOLVED", "VERIFIED", "CLOSED"])
        ))
    elif min_overdue_hours is not None and min_overdue_hours > 0:
        overdue_threshold = now_utc - timedelta(hours=min_overdue_hours)
        conditions.append(and_(
            Bug.sla_due_date <= overdue_threshold,
            Bug.status.notin_(["RESOLVED", "VERIFIED", "CLOSED"])
        ))
    elif sla_breached is not None:
        conditions.append(Bug.sla_breached == sla_breached)
        
    if is_security_sensitive is not None:
        conditions.append(Bug.is_security_sensitive == is_security_sensitive)
    if min_impact_score is not None:
        conditions.append(Bug.impact_score >= min_impact_score)
        
    if days_back:
        since_time = datetime.now(timezone.utc) - timedelta(days=days_back)
        conditions.append(Bug.created_at >= since_time)
        
    if q and q.strip():
        stop_words = {
            "in", "on", "at", "for", "to", "with", "and", "or", "a", "an", "the",
            "is", "are", "was", "were", "bug", "bugs", "issue", "issues", "defect",
            "defects", "show", "find", "list", "me", "all", "get", "of", "from", "which"
        }
        raw_terms = [t.strip() for t in q.replace('"', '').replace("'", "").split()]
        terms = [t for t in raw_terms if len(t) > 1 and t.lower() not in stop_words]
        if not terms and raw_terms:
            terms = raw_terms  # Fallback if query was only short words
            
        if terms:
            term_conditions = []
            for term in terms:
                pattern = f"%{term}%"
                term_conditions.append(or_(
                    Bug.title.ilike(pattern),
                    Bug.description.ilike(pattern),
                    Bug.bug_key.ilike(pattern),
                    Bug.component.ilike(pattern),
                    Bug.category.ilike(pattern),
                    Bug.labels.ilike(pattern),
                    Bug.assignee.has(User.full_name.ilike(pattern))
                ))
            conditions.append(and_(*term_conditions))
        
    if conditions:
        query = query.filter(and_(*conditions))
        
    query = query.order_by(desc(Bug.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    bugs = result.scalars().all()
    
    return [_format_bug_response(b) for b in bugs]

@router.get("/{bug_id}", response_model=BugDetailResponse)
async def get_bug(
    bug_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Bug).options(
        selectinload(Bug.reporter),
        selectinload(Bug.assignee),
        selectinload(Bug.comments),
        selectinload(Bug.attachments),
        selectinload(Bug.git_integrations),
        selectinload(Bug.audit_logs),
        selectinload(Bug.relations_as_source).selectinload(BugRelation.target_bug),
        selectinload(Bug.relations_as_target).selectinload(BugRelation.source_bug)
    ).filter(Bug.id == bug_id)
    
    result = await db.execute(query)
    bug = result.scalars().first()
    if not bug:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug not found")
        
    # Permission check for security sensitive bugs
    if bug.is_security_sensitive and current_user.role == "REPORTER" and bug.reporter_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access to security-sensitive bug is restricted")
        
    base_resp = _format_bug_response(bug)
    
    # Process relations
    relations_list = []
    for rel in bug.relations_as_source:
        target = rel.target_bug
        relations_list.append(BugRelationResponse(
            id=rel.id,
            source_bug_id=rel.source_bug_id,
            target_bug_id=rel.target_bug_id,
            relation_type=rel.relation_type,
            target_bug_key=target.bug_key if target else None,
            target_bug_title=target.title if target else None,
            target_bug_status=target.status if target else None,
            created_at=rel.created_at
        ))
        
    # Process Git Integrations
    git_list = []
    for g in bug.git_integrations:
        git_list.append(GitIntegrationItem(
            id=g.id,
            branch_name=g.branch_name,
            commit_sha=g.commit_sha,
            commit_message=g.commit_message,
            pr_number=g.pr_number,
            pr_title=g.pr_title,
            pr_status=g.pr_status,
            release_tag=g.release_tag,
            author=g.author,
            url=g.url,
            created_at=g.created_at,
            updated_at=g.updated_at
        ))
        
    # Process Audit logs
    audit_list = []
    for a in bug.audit_logs:
        audit_list.append(AuditLogResponse(
            id=a.id,
            bug_id=a.bug_id,
            user_id=a.user_id,
            user_name=a.user_name,
            action=a.action,
            field_name=a.field_name,
            old_value=a.old_value,
            new_value=a.new_value,
            reason=a.reason,
            timestamp=a.timestamp
        ))
        
    return BugDetailResponse(
        **base_resp.model_dump(),
        relations=relations_list,
        git_integrations=git_list,
        audit_logs=audit_list
    )

@router.post("", response_model=BugResponse)
async def create_bug(
    bug_data: BugCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify Project
    proj_res = await db.execute(select(Project).filter(Project.id == bug_data.project_id))
    project = proj_res.scalars().first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target project not found")
        
    # Generate sequential bug key (e.g. PAY-105)
    count_res = await db.execute(select(func.count(Bug.id)).filter(Bug.project_id == project.id))
    next_num = (count_res.scalar() or 0) + 101
    bug_key = f"{project.key}-{next_num}"
    
    # Calculate Quality score
    quality_analysis = ai_service.analyze_quality(
        title=bug_data.title,
        description=bug_data.description,
        steps=bug_data.steps_to_reproduce,
        expected=bug_data.expected_behavior,
        actual=bug_data.actual_behavior,
        technical_context=bug_data.technical_context
    )
    quality_score = quality_analysis["score"]
    
    # Calculate Priority & SLA Due Date
    priority = bug_data.priority or "P3"
    now = datetime.now(timezone.utc)
    sla_due_date = calculate_sla_due_date(priority, now)
    
    bug = Bug(
        bug_key=bug_key,
        project_id=project.id,
        title=bug_data.title,
        description=bug_data.description,
        steps_to_reproduce=bug_data.steps_to_reproduce,
        expected_behavior=bug_data.expected_behavior,
        actual_behavior=bug_data.actual_behavior,
        category=bug_data.category or "General",
        component=bug_data.component or "Core",
        severity=bug_data.severity or "MEDIUM",
        priority=priority,
        impact_score=bug_data.impact_score or 50,
        status="NEW",
        environment=bug_data.environment or "Production",
        reporter_id=current_user.id,
        assignee_id=bug_data.assignee_id,
        labels=json.dumps(bug_data.labels or []),
        is_security_sensitive=bug_data.is_security_sensitive or False,
        technical_context=json.dumps(bug_data.technical_context or {}),
        quality_score=quality_score,
        sla_due_date=sla_due_date,
        created_at=now,
        updated_at=now
    )
    db.add(bug)
    await db.commit()
    await db.refresh(bug)
    
    # Record Initial Creation Audit Log
    await workflow_service.record_audit_log(
        session=db,
        bug_id=bug.id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        action="CREATED",
        old_value=None,
        new_value="NEW",
        reason=f"Bug created with initial quality score {quality_score}/100"
    )
    
    # Notify assignee if assigned on creation
    if bug.assignee_id:
        await workflow_service.create_notification(
            session=db,
            user_id=bug.assignee_id,
            type="ASSIGNED",
            title=f"New bug assigned: {bug.bug_key}",
            message=f"You have been assigned to '{bug.title}' ({bug.priority} - {bug.severity})",
            bug_id=bug.id,
            bug_key=bug.bug_key
        )
        
    await db.commit()
    
    # Broadcast live real-time notification to all connected users
    try:
        await ws_manager.broadcast({
            "type": "BUG_CREATED",
            "bug_id": bug.id,
            "bug_key": bug.bug_key,
            "title": bug.title,
            "reporter_name": current_user.full_name,
            "reporter_role": current_user.role,
            "assignee_id": bug.assignee_id,
            "priority": bug.priority,
            "severity": bug.severity,
            "status": bug.status,
            "message": f"{current_user.full_name} ({current_user.role}) reported new bug {bug.bug_key}: '{bug.title}' ({bug.priority})"
        })
    except Exception:
        pass
    
    # Reload bug with relations
    return await get_bug(bug.id, current_user, db)

@router.patch("/{bug_id}", response_model=BugResponse)
async def update_bug(
    bug_id: int,
    bug_update: BugUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Bug).options(
        selectinload(Bug.reporter),
        selectinload(Bug.assignee)
    ).filter(Bug.id == bug_id)
    result = await db.execute(query)
    bug = result.scalars().first()
    if not bug:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug not found")
        
    now = datetime.now(timezone.utc)
    
    # Handle Status Change & Workflow State Machine
    if bug_update.status and bug_update.status.upper() != bug.status:
        target_status = bug_update.status.upper()
        valid, msg = workflow_service.is_valid_transition(bug.status, target_status, current_user.role)
        if not valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
            
        old_status = bug.status
        bug.status = target_status
        if target_status in ["RESOLVED", "VERIFIED", "CLOSED"] and not bug.resolved_at:
            bug.resolved_at = now
        elif target_status == "REOPENED":
            bug.resolved_at = None
            
        await workflow_service.record_audit_log(
            session=db,
            bug_id=bug.id,
            user_id=current_user.id,
            user_name=current_user.full_name,
            action="STATUS_CHANGED",
            field_name="status",
            old_value=old_status,
            new_value=target_status,
            reason=bug_update.reason or f"Status changed by {current_user.full_name}"
        )
        
        # Notify reporter on status change
        # Notify reporter on status change
        if bug.reporter_id and bug.reporter_id != current_user.id:
            await workflow_service.create_notification(
                session=db,
                user_id=bug.reporter_id,
                type="STATUS_CHANGED",
                title=f"Bug {bug.bug_key} status updated to {target_status}",
                message=f"Status was moved from {old_status} to {target_status} by {current_user.full_name}",
                bug_id=bug.id,
                bug_key=bug.bug_key
            )
            
        try:
            await ws_manager.broadcast({
                "type": "STATUS_CHANGED",
                "bug_id": bug.id,
                "bug_key": bug.bug_key,
                "title": bug.title,
                "old_status": old_status,
                "new_status": target_status,
                "updated_by": current_user.full_name,
                "role": current_user.role,
                "message": f"{current_user.full_name} moved {bug.bug_key} to {target_status.replace('_', ' ')}"
            })
        except Exception:
            pass

    # Handle Priority change
    if bug_update.priority and bug_update.priority.upper() != bug.priority:
        old_prio = bug.priority
        bug.priority = bug_update.priority.upper()
        bug.sla_due_date = calculate_sla_due_date(bug.priority, bug.created_at)
        
        await workflow_service.record_audit_log(
            session=db,
            bug_id=bug.id,
            user_id=current_user.id,
            user_name=current_user.full_name,
            action="PRIORITY_CHANGED",
            field_name="priority",
            old_value=old_prio,
            new_value=bug.priority,
            reason=bug_update.reason or "Priority updated"
        )
        
        if bug.assignee_id:
            await workflow_service.create_notification(
                session=db,
                user_id=bug.assignee_id,
                type="PRIORITY_CHANGED",
                title=f"Priority updated for {bug.bug_key}: {old_prio} -> {bug.priority}",
                message=f"Priority adjusted by {current_user.full_name}. SLA deadline recalculated.",
                bug_id=bug.id,
                bug_key=bug.bug_key
            )

    # Handle Assignee change
    if bug_update.assignee_id is not None and bug_update.assignee_id != bug.assignee_id:
        old_assignee_id = bug.assignee_id
        bug.assignee_id = bug_update.assignee_id
        
        # Fetch new assignee name
        new_assignee_name = "Unassigned"
        if bug_update.assignee_id:
            user_res = await db.execute(select(User).filter(User.id == bug_update.assignee_id))
            new_u = user_res.scalars().first()
            if new_u:
                new_assignee_name = new_u.full_name
                
        await workflow_service.record_audit_log(
            session=db,
            bug_id=bug.id,
            user_id=current_user.id,
            user_name=current_user.full_name,
            action="ASSIGNED",
            field_name="assignee",
            old_value=str(old_assignee_id),
            new_value=new_assignee_name,
            reason=bug_update.reason or "Assignee updated"
        )
        
        if bug.assignee_id and bug.assignee_id != current_user.id:
            await workflow_service.create_notification(
                session=db,
                user_id=bug.assignee_id,
                type="ASSIGNED",
                title=f"Assigned to {bug.bug_key}",
                message=f"{current_user.full_name} assigned you to '{bug.title}'",
                bug_id=bug.id,
                bug_key=bug.bug_key
            )
            
        try:
            await ws_manager.broadcast({
                "type": "BUG_ASSIGNED",
                "bug_id": bug.id,
                "bug_key": bug.bug_key,
                "title": bug.title,
                "assignee_id": bug.assignee_id,
                "assignee_name": new_assignee_name,
                "updated_by": current_user.full_name,
                "message": f"{current_user.full_name} assigned {bug.bug_key} to {new_assignee_name}"
            })
        except Exception:
            pass

    # Update standard fields
    if bug_update.title:
        bug.title = bug_update.title
    if bug_update.description:
        bug.description = bug_update.description
    if bug_update.steps_to_reproduce is not None:
        bug.steps_to_reproduce = bug_update.steps_to_reproduce
    if bug_update.expected_behavior is not None:
        bug.expected_behavior = bug_update.expected_behavior
    if bug_update.actual_behavior is not None:
        bug.actual_behavior = bug_update.actual_behavior
    if bug_update.category:
        bug.category = bug_update.category
    if bug_update.component:
        bug.component = bug_update.component
    if bug_update.severity:
        bug.severity = bug_update.severity.upper()
    if bug_update.environment:
        bug.environment = bug_update.environment
    if bug_update.labels is not None:
        bug.labels = json.dumps(bug_update.labels)
    if bug_update.is_security_sensitive is not None:
        bug.is_security_sensitive = bug_update.is_security_sensitive
    if bug_update.is_stale is not None:
        bug.is_stale = bug_update.is_stale
    if bug_update.impact_score is not None:
        bug.impact_score = bug_update.impact_score

    bug.updated_at = now
    await db.commit()
    await db.refresh(bug)
    
    return await get_bug(bug.id, current_user, db)

@router.post("/{bug_id}/relations", response_model=BugRelationResponse)
async def add_bug_relation(
    bug_id: int,
    rel_data: BugRelationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify both bugs exist
    b1_res = await db.execute(select(Bug).filter(Bug.id == bug_id))
    b1 = b1_res.scalars().first()
    b2_res = await db.execute(select(Bug).filter(Bug.id == rel_data.target_bug_id))
    b2 = b2_res.scalars().first()
    
    if not b1 or not b2:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One of the bugs was not found")
        
    rel = BugRelation(
        source_bug_id=bug_id,
        target_bug_id=rel_data.target_bug_id,
        relation_type=rel_data.relation_type.upper()
    )
    db.add(rel)
    
    await workflow_service.record_audit_log(
        session=db,
        bug_id=bug_id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        action="RELATION_ADDED",
        field_name="relation",
        old_value=None,
        new_value=f"{rel_data.relation_type} -> {b2.bug_key}",
        reason=f"Linked relation with {b2.bug_key}"
    )
    
    await db.commit()
    await db.refresh(rel)
    
    return BugRelationResponse(
        id=rel.id,
        source_bug_id=rel.source_bug_id,
        target_bug_id=rel.target_bug_id,
        relation_type=rel.relation_type,
        target_bug_key=b2.bug_key,
        target_bug_title=b2.title,
        target_bug_status=b2.status,
        created_at=rel.created_at
    )

@router.delete("/{bug_id}/relations/{relation_id}")
async def delete_bug_relation(
    bug_id: int,
    relation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    rel_res = await db.execute(select(BugRelation).filter(BugRelation.id == relation_id, BugRelation.source_bug_id == bug_id))
    rel = rel_res.scalars().first()
    if not rel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Relation not found")
        
    await db.delete(rel)
    await db.commit()
    return {"success": True, "message": "Relation removed"}
