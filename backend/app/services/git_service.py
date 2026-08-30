import random
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.db.models import Bug, GitIntegration, AuditLog, Notification
from backend.app.services.workflow_service import workflow_service

class GitService:
    @staticmethod
    async def simulate_git_event(
        session: AsyncSession,
        bug: Bug,
        event_type: str,
        user_name: str = "developer",
        user_id: Optional[int] = None,
        custom_branch: Optional[str] = None,
        custom_pr_num: Optional[int] = None
    ) -> Tuple[bool, str, str, str, Optional[GitIntegration]]:
        """
        Simulates GitHub Git/PR Lifecycle events and automatically updates bug status:
        - branch_created -> IN_DEVELOPMENT
        - commit_pushed  -> IN_DEVELOPMENT
        - pr_opened      -> CODE_REVIEW
        - pr_review_approved -> CODE_REVIEW (Approved)
        - pr_merged      -> TESTING
        - release_tagged -> VERIFIED
        """
        old_status = bug.status
        new_status = old_status
        message = ""
        
        branch_name = custom_branch or f"fix/{bug.bug_key.lower()}-{bug.title.lower().replace(' ', '-')[:25]}"
        commit_sha = f"{random.randint(1000000, 9999999):x}"[:7]
        pr_number = custom_pr_num or random.randint(101, 999)
        
        git_record = None
        
        if event_type == "branch_created":
            if old_status in ["NEW", "TRIAGED", "ASSIGNED"]:
                new_status = "IN_DEVELOPMENT"
            git_record = GitIntegration(
                bug_id=bug.id,
                branch_name=branch_name,
                commit_message=f"Initial branch checkout for {bug.bug_key}",
                author=user_name,
                url=f"https://github.com/org/repo/tree/{branch_name}"
            )
            session.add(git_record)
            message = f"Branch '{branch_name}' created. Status updated to {new_status}."

        elif event_type == "commit_pushed":
            if old_status in ["NEW", "TRIAGED", "ASSIGNED"]:
                new_status = "IN_DEVELOPMENT"
            git_record = GitIntegration(
                bug_id=bug.id,
                branch_name=branch_name,
                commit_sha=commit_sha,
                commit_message=f"fix({bug.bug_key}): resolve root cause in {bug.component}",
                author=user_name,
                url=f"https://github.com/org/repo/commit/{commit_sha}"
            )
            session.add(git_record)
            message = f"Commit {commit_sha} pushed by {user_name}."

        elif event_type == "pr_opened":
            new_status = "CODE_REVIEW"
            git_record = GitIntegration(
                bug_id=bug.id,
                branch_name=branch_name,
                commit_sha=commit_sha,
                pr_number=pr_number,
                pr_title=f"Fix {bug.bug_key}: {bug.title}",
                pr_status="OPEN",
                author=user_name,
                url=f"https://github.com/org/repo/pull/{pr_number}"
            )
            session.add(git_record)
            message = f"Pull Request #{pr_number} opened: '{git_record.pr_title}'. Bug transitioned to CODE_REVIEW."

        elif event_type == "pr_review_approved":
            new_status = "CODE_REVIEW"
            git_record = GitIntegration(
                bug_id=bug.id,
                branch_name=branch_name,
                pr_number=pr_number,
                pr_title=f"Fix {bug.bug_key}: {bug.title}",
                pr_status="APPROVED",
                author=user_name,
                url=f"https://github.com/org/repo/pull/{pr_number}"
            )
            session.add(git_record)
            message = f"Pull Request #{pr_number} review approved by Senior Reviewer."

        elif event_type == "pr_merged":
            new_status = "TESTING"
            git_record = GitIntegration(
                bug_id=bug.id,
                branch_name=branch_name,
                commit_sha=commit_sha,
                pr_number=pr_number,
                pr_title=f"Fix {bug.bug_key}: {bug.title}",
                pr_status="MERGED",
                author=user_name,
                url=f"https://github.com/org/repo/pull/{pr_number}"
            )
            session.add(git_record)
            message = f"Pull Request #{pr_number} merged into main branch. Bug automatically moved to TESTING for QA verification."

        elif event_type == "release_tagged":
            new_status = "VERIFIED"
            version_tag = f"v2.{random.randint(5, 9)}.{random.randint(0, 5)}"
            git_record = GitIntegration(
                bug_id=bug.id,
                release_tag=version_tag,
                commit_message=f"Release {version_tag} deployed to production",
                author="ReleaseBot",
                url=f"https://github.com/org/repo/releases/tag/{version_tag}"
            )
            session.add(git_record)
            message = f"Deployed in release tag {version_tag}. Bug verified."
            
        else:
            return False, old_status, old_status, f"Unknown event type {event_type}", None

        # Update bug status if changed
        if new_status != old_status:
            bug.status = new_status
            if new_status in ["RESOLVED", "VERIFIED", "CLOSED"]:
                bug.resolved_at = datetime.now(timezone.utc)
                
            await workflow_service.record_audit_log(
                session=session,
                bug_id=bug.id,
                user_id=user_id,
                user_name=f"GitHub Webhook ({user_name})",
                action="GIT_EVENT",
                field_name="status",
                old_value=old_status,
                new_value=new_status,
                reason=f"GitHub Automated Workflow: {event_type.replace('_', ' ').title()}"
            )
            
            # Notify assignee if someone else triggered it
            if bug.assignee_id:
                await workflow_service.create_notification(
                    session=session,
                    user_id=bug.assignee_id,
                    type="PR_EVENT",
                    title=f"Git Workflow Update: {bug.bug_key}",
                    message=message,
                    bug_id=bug.id,
                    bug_key=bug.bug_key
                )

        return True, old_status, new_status, message, git_record

git_service = GitService()
