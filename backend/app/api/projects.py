import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from backend.app.db.session import get_db
from backend.app.db.models import Project, Bug, User
from backend.app.schemas.projects import ProjectCreate, ProjectUpdate, ProjectResponse
from backend.app.api.auth import get_current_user, require_role

router = APIRouter(prefix="/projects", tags=["Projects Management"])

@router.get("", response_model=List[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.id.asc()))
    projects = result.scalars().all()
    
    response = []
    for p in projects:
        # Compute bug counts
        bug_count_res = await db.execute(select(func.count(Bug.id)).filter(Bug.project_id == p.id))
        bug_count = bug_count_res.scalar() or 0
        
        open_res = await db.execute(select(func.count(Bug.id)).filter(
            Bug.project_id == p.id,
            Bug.status.notin_(["RESOLVED", "VERIFIED", "CLOSED"])
        ))
        open_count = open_res.scalar() or 0
        
        crit_res = await db.execute(select(func.count(Bug.id)).filter(
            Bug.project_id == p.id,
            Bug.severity == "CRITICAL",
            Bug.status.notin_(["RESOLVED", "VERIFIED", "CLOSED"])
        ))
        crit_count = crit_res.scalar() or 0
        
        comps = json.loads(p.components) if isinstance(p.components, str) else p.components
        envs = json.loads(p.environments) if isinstance(p.environments, str) else p.environments
        
        response.append(ProjectResponse(
            id=p.id,
            key=p.key,
            name=p.name,
            description=p.description,
            lead_id=p.lead_id,
            components=comps,
            environments=envs,
            created_at=p.created_at,
            updated_at=p.updated_at,
            bug_count=bug_count,
            open_bug_count=open_count,
            critical_bug_count=crit_count
        ))
    return response

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).filter(Project.id == project_id))
    p = result.scalars().first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
    bug_count_res = await db.execute(select(func.count(Bug.id)).filter(Bug.project_id == p.id))
    bug_count = bug_count_res.scalar() or 0
    
    open_res = await db.execute(select(func.count(Bug.id)).filter(
        Bug.project_id == p.id,
        Bug.status.notin_(["RESOLVED", "VERIFIED", "CLOSED"])
    ))
    open_count = open_res.scalar() or 0
    
    crit_res = await db.execute(select(func.count(Bug.id)).filter(
        Bug.project_id == p.id,
        Bug.severity == "CRITICAL",
        Bug.status.notin_(["RESOLVED", "VERIFIED", "CLOSED"])
    ))
    crit_count = crit_res.scalar() or 0
    
    comps = json.loads(p.components) if isinstance(p.components, str) else p.components
    envs = json.loads(p.environments) if isinstance(p.environments, str) else p.environments
    
    return ProjectResponse(
        id=p.id,
        key=p.key,
        name=p.name,
        description=p.description,
        lead_id=p.lead_id,
        components=comps,
        environments=envs,
        created_at=p.created_at,
        updated_at=p.updated_at,
        bug_count=bug_count,
        open_bug_count=open_count,
        critical_bug_count=crit_count
    )

@router.post("", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(require_role(["ADMIN", "PROJECT_MANAGER"])),
    db: AsyncSession = Depends(get_db)
):
    # Check duplicate key
    existing = await db.execute(select(Project).filter(Project.key == project_data.key.upper()))
    if existing.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project key already exists")
        
    p = Project(
        key=project_data.key.upper(),
        name=project_data.name,
        description=project_data.description,
        lead_id=project_data.lead_id or current_user.id,
        components=json.dumps(project_data.components or []),
        environments=json.dumps(project_data.environments or ["Production", "Staging", "QA"])
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    
    return ProjectResponse(
        id=p.id,
        key=p.key,
        name=p.name,
        description=p.description,
        lead_id=p.lead_id,
        components=project_data.components or [],
        environments=project_data.environments or ["Production", "Staging", "QA"],
        created_at=p.created_at,
        updated_at=p.updated_at,
        bug_count=0,
        open_bug_count=0,
        critical_bug_count=0
    )
