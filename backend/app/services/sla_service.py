from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from backend.app.config import settings

def calculate_sla_due_date(priority: str, created_at: Optional[datetime] = None) -> datetime:
    base_time = created_at or datetime.now(timezone.utc)
    if base_time.tzinfo is None:
        base_time = base_time.replace(tzinfo=timezone.utc)
        
    p = priority.upper() if priority else "P3"
    hours = {
        "P1": settings.SLA_HOURS_P1,
        "P2": settings.SLA_HOURS_P2,
        "P3": settings.SLA_HOURS_P3,
        "P4": settings.SLA_HOURS_P4
    }.get(p, 168)
    
    return base_time + timedelta(hours=hours)

def evaluate_sla_status(created_at: datetime, sla_due_date: Optional[datetime], status: str, resolved_at: Optional[datetime] = None) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
        
    is_closed_or_resolved = status in ["RESOLVED", "VERIFIED", "CLOSED"]
    
    # Calculate age in days
    age_seconds = (now - created_at).total_seconds()
    age_days = max(int(age_seconds / 86400), 0)
    
    if not sla_due_date:
        return {
            "sla_breached": False,
            "sla_hours_remaining": None,
            "sla_percentage": 100,
            "age_days": age_days,
            "is_stale": age_days >= settings.STALE_BUG_DAYS and not is_closed_or_resolved
        }
        
    if sla_due_date.tzinfo is None:
        sla_due_date = sla_due_date.replace(tzinfo=timezone.utc)
        
    total_window_seconds = (sla_due_date - created_at).total_seconds()
    
    if is_closed_or_resolved:
        # Check if resolved before due date
        end_time = resolved_at or now
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        breached = end_time > sla_due_date
        return {
            "sla_breached": breached,
            "sla_hours_remaining": 0.0,
            "sla_percentage": 0 if breached else 100,
            "age_days": age_days,
            "is_stale": False
        }
    
    # Still open
    remaining_seconds = (sla_due_date - now).total_seconds()
    hours_remaining = round(remaining_seconds / 3600.0, 1)
    breached = hours_remaining < 0
    
    # Calculate percentage (100% at created_at, 0% at due_date)
    if total_window_seconds > 0:
        pct = int(round((remaining_seconds / total_window_seconds) * 100))
        sla_percentage = max(min(pct, 100), 0)
    else:
        sla_percentage = 0
        
    is_stale = age_days >= settings.STALE_BUG_DAYS
    
    return {
        "sla_breached": breached,
        "sla_hours_remaining": hours_remaining,
        "sla_percentage": sla_percentage,
        "age_days": age_days,
        "is_stale": is_stale
    }
