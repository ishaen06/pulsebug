from typing import Tuple, Optional, List
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.db.models import Bug, AuditLog, Notification, User

# Canonical Workflow Statuses (2 Roles: Developer & Tester)
# REPORTED -> AI_TRIAGE -> IN_DEVELOPMENT -> READY_FOR_TESTING -> VERIFIED -> CLOSED
# If testing fails: READY_FOR_TESTING -> REOPENED -> IN_DEVELOPMENT

VALID_STATUSES = [
    "REPORTED",
    "NEW",               # alias for REPORTED
    "AI_TRIAGE",
    "TRIAGED",           # alias for AI_TRIAGE
    "IN_DEVELOPMENT",
    "READY_FOR_TESTING",
    "TESTING",           # alias for READY_FOR_TESTING
    "VERIFIED",
    "RESOLVED",          # alias for VERIFIED
    "CLOSED",
    "REOPENED"
]

# Transition rules (From -> Allowed Tos)
ALLOWED_TRANSITIONS = {
    "REPORTED": ["AI_TRIAGE", "IN_DEVELOPMENT", "CLOSED"],
    "NEW": ["AI_TRIAGE", "TRIAGED", "IN_DEVELOPMENT", "CLOSED"],
    "AI_TRIAGE": ["IN_DEVELOPMENT", "READY_FOR_TESTING", "CLOSED"],
    "TRIAGED": ["IN_DEVELOPMENT", "READY_FOR_TESTING", "CLOSED"],
    "IN_DEVELOPMENT": ["READY_FOR_TESTING", "TESTING", "REOPENED", "CLOSED"],
    "READY_FOR_TESTING": ["VERIFIED", "RESOLVED", "REOPENED", "IN_DEVELOPMENT", "CLOSED"],
    "TESTING": ["VERIFIED", "RESOLVED", "REOPENED", "IN_DEVELOPMENT", "CLOSED"],
    "VERIFIED": ["CLOSED", "REOPENED"],
    "RESOLVED": ["VERIFIED", "CLOSED", "REOPENED"],
    "CLOSED": ["REOPENED"],
    "REOPENED": ["IN_DEVELOPMENT", "AI_TRIAGE", "READY_FOR_TESTING", "CLOSED"]
}

# Role-based permitted targets
DEVELOPER_ALLOWED_TARGETS = ["IN_DEVELOPMENT", "READY_FOR_TESTING", "TESTING", "AI_TRIAGE"]
TESTER_ALLOWED_TARGETS = ["VERIFIED", "RESOLVED", "CLOSED", "REOPENED", "READY_FOR_TESTING", "IN_DEVELOPMENT"]

class WorkflowService:
    @staticmethod
    def is_valid_transition(current_status: str, target_status: str, role: str = "DEVELOPER") -> Tuple[bool, str]:
        current_status = current_status.upper()
        target_status = target_status.upper()
        role = role.upper()
        
        if current_status == target_status:
            return True, "No change"
            
        if target_status not in VALID_STATUSES:
            return False, f"Invalid status '{target_status}'. Valid states: {', '.join(VALID_STATUSES)}"
            
        allowed = ALLOWED_TRANSITIONS.get(current_status, [])
        if target_status not in allowed:
            return False, f"Cannot transition from {current_status} to {target_status}. Allowed transitions: {', '.join(allowed)}"
            
        # Role-based permission checks:
        if role == "DEVELOPER":
            # Developer can move bugs to IN_DEVELOPMENT or READY_FOR_TESTING
            if target_status in ["VERIFIED", "RESOLVED", "CLOSED"] and current_status in ["READY_FOR_TESTING", "TESTING"]:
                return False, "Only a Tester can verify and close bugs marked Ready for Testing."
        elif role == "TESTER":
            # Tester can verify, fail/reopen, or close
            pass
            
        return True, "Transition valid"

    @staticmethod
    async def record_audit_log(
        session: AsyncSession,
        bug_id: int,
        user_id: Optional[int],
        user_name: str,
        action: str,
        field_name: Optional[str] = None,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        reason: Optional[str] = None
    ) -> AuditLog:
        log = AuditLog(
            bug_id=bug_id,
            user_id=user_id,
            user_name=user_name,
            action=action,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            reason=reason,
            timestamp=datetime.now(timezone.utc)
        )
        session.add(log)
        return log

    @staticmethod
    async def create_notification(
        session: AsyncSession,
        user_id: int,
        type: str,
        title: str,
        message: str,
        bug_id: Optional[int] = None,
        bug_key: Optional[str] = None
    ) -> Notification:
        notif = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            bug_id=bug_id,
            bug_key=bug_key,
            is_read=False,
            created_at=datetime.now(timezone.utc)
        )
        session.add(notif)
        return notif

workflow_service = WorkflowService()
