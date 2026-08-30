import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from backend.app.db.session import get_db
from backend.app.db.models import Bug, User, Project
from backend.app.schemas.ai import (
    AITriageRequest, AITriageResponse,
    AIDuplicateCheckRequest, AIDuplicateCheckResponse,
    AIQualityScoreRequest, AIQualityScoreResponse,
    AIReproductionStepsRequest, AIReproductionStepsResponse,
    AIAssigneeRecommendRequest, AIAssigneeRecommendResponse,
    AIPrioritizeRequest, AIPrioritizeResponse,
    AINLSearchRequest, AINLSearchResponse
)
from backend.app.services.ai_service import ai_service
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["AI & Intelligence Engines"])

@router.post("/triage", response_model=AITriageResponse)
async def triage_bug(
    req: AITriageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    AI Bug Triage Engine: Analyzes bug description and suggests category,
    component, severity, priority, suggested labels, and recommended developer/team.
    """
    result = ai_service.triage_bug(
        title=req.title,
        description=req.description,
        steps=req.steps_to_reproduce
    )
    
    # Try to find user ID matching suggested assignee
    assignee_id = None
    if result.get("suggested_assignee"):
        user_res = await db.execute(select(User).filter(User.full_name.ilike(f"%{result['suggested_assignee']}%")))
        u = user_res.scalars().first()
        if u:
            assignee_id = u.id
            
    return AITriageResponse(
        category=result["category"],
        component=result["component"],
        severity=result["severity"],
        priority=result["priority"],
        suggested_labels=result["suggested_labels"],
        suggested_assignee=result["suggested_assignee"],
        suggested_assignee_id=assignee_id,
        confidence_score=result["confidence_score"],
        reasoning=result["reasoning"]
    )

@router.post("/duplicate-check", response_model=AIDuplicateCheckResponse)
async def check_duplicates(
    req: AIDuplicateCheckRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    AI Duplicate Bug Detection & Regression Detection:
    Calculates semantic and text similarity against existing and resolved bugs in the project.
    """
    query = select(Bug)
    if req.project_id:
        query = query.filter(Bug.project_id == req.project_id)
    if req.exclude_bug_id:
        query = query.filter(Bug.id != req.exclude_bug_id)
        
    res = await db.execute(query)
    bugs = res.scalars().all()
    
    bugs_data = []
    for b in bugs:
        bugs_data.append({
            "id": b.id,
            "bug_key": b.bug_key,
            "title": b.title,
            "description": b.description,
            "component": b.component,
            "status": b.status,
            "severity": b.severity
        })
        
    analysis = ai_service.detect_duplicates(
        title=req.title,
        description=req.description,
        existing_bugs=bugs_data
    )
    
    return AIDuplicateCheckResponse(
        has_duplicates=analysis["has_duplicates"],
        highest_similarity=analysis["highest_similarity"],
        duplicates=analysis["duplicates"],
        is_possible_regression=analysis["is_possible_regression"],
        regression_reference_bug=analysis.get("regression_reference_bug")
    )

@router.post("/quality-score", response_model=AIQualityScoreResponse)
async def analyze_quality(
    req: AIQualityScoreRequest,
    current_user: User = Depends(get_current_user)
):
    """
    AI Bug Report Quality Analyzer:
    Evaluates whether the report has enough detail (clear title, reproduction steps,
    expected vs actual, technical context, logs/frequency) and returns a score (0-100)
    with actionable suggestions.
    """
    res = ai_service.analyze_quality(
        title=req.title,
        description=req.description,
        steps=req.steps_to_reproduce,
        expected=req.expected_behavior,
        actual=req.actual_behavior,
        technical_context=req.technical_context
    )
    return AIQualityScoreResponse(**res)

@router.post("/reproduction-steps", response_model=AIReproductionStepsResponse)
async def generate_reproduction_steps(
    req: AIReproductionStepsRequest,
    current_user: User = Depends(get_current_user)
):
    """
    AI Reproduction Step Generator:
    Converts messy, unstructured natural language narratives into clean numbered steps,
    expected behavior, and actual behavior.
    """
    res = ai_service.generate_reproduction_steps(req.messy_description)
    return AIReproductionStepsResponse(**res)

@router.post("/recommend-assignee", response_model=AIAssigneeRecommendResponse)
async def recommend_assignee(
    req: AIAssigneeRecommendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Intelligent Developer Assignment Engine:
    Ranks developers based on expertise, historical resolved components, current workload,
    severity, and availability.
    """
    users_res = await db.execute(select(User).filter(User.role == "DEVELOPER"))
    all_users = users_res.scalars().all()
    
    users_payload = []
    bugs_summary = {}
    
    for u in all_users:
        skills = json.loads(u.skills) if isinstance(u.skills, str) else (u.skills or [])
        users_payload.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "avatar_url": u.avatar_url,
            "skills": skills,
            "active_status": u.active_status
        })
        
        # Count active and critical bugs
        active_res = await db.execute(select(func.count(Bug.id)).filter(
            Bug.assignee_id == u.id,
            Bug.status.notin_(["RESOLVED", "VERIFIED", "CLOSED"])
        ))
        active_count = active_res.scalar() or 0
        
        crit_res = await db.execute(select(func.count(Bug.id)).filter(
            Bug.assignee_id == u.id,
            Bug.severity == "CRITICAL",
            Bug.status.notin_(["RESOLVED", "VERIFIED", "CLOSED"])
        ))
        crit_count = crit_res.scalar() or 0
        
        resolved_res = await db.execute(select(func.count(Bug.id)).filter(
            Bug.assignee_id == u.id,
            Bug.component.ilike(f"%{req.component}%"),
            Bug.status.in_(["RESOLVED", "VERIFIED", "CLOSED"])
        ))
        resolved_in_comp = resolved_res.scalar() or 0
        
        bugs_summary[u.id] = {
            "active_count": active_count,
            "critical_count": crit_count,
            "resolved_in_component": resolved_in_comp
        }
        
    res = ai_service.recommend_assignees(
        component=req.component,
        category=req.category,
        severity=req.severity,
        title=req.title,
        description=req.description,
        users=users_payload,
        bugs_summary=bugs_summary
    )
    
    return AIAssigneeRecommendResponse(**res)

@router.post("/prioritize", response_model=AIPrioritizeResponse)
async def prioritize_bug(
    req: AIPrioritizeRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Intelligent Bug Prioritization Engine:
    Computes an objective 0-100 Impact Score from severity, user blast radius,
    production environment, security/financial risk, frequency, and regression status.
    """
    res = ai_service.calculate_priority_score(
        severity=req.severity,
        affected_users=req.affected_users_estimate or "100-1000",
        is_production=req.is_production if req.is_production is not None else True,
        is_security=req.is_security_impact or False,
        is_financial=req.is_financial_or_data_loss or False,
        is_regression=req.is_regression or False,
        frequency=req.frequency or "Often"
    )
    return AIPrioritizeResponse(**res)

@router.post("/nl-search", response_model=AINLSearchResponse)
async def parse_natural_language_search(
    req: AINLSearchRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Natural Language Search Engine:
    Translates English queries into structured filters.
    """
    res = ai_service.parse_natural_language_search(req.query)
    return AINLSearchResponse(**res)
