import json
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from backend.app.core.security import get_password_hash
from backend.app.db.models import (
    User, Project, Bug, BugRelation, Comment, GitIntegration, AuditLog, Notification, AIRecommendation
)
from backend.app.services.sla_service import calculate_sla_due_date, evaluate_sla_status

def seed_database(db: Session, force: bool = False):
    # Check if already seeded with bugs
    if not force and db.query(Bug).count() > 0:
        return

    now = datetime.now(timezone.utc)
    
    # ----------------------------------------------------------------------
    # 1. CREATE USERS
    # ----------------------------------------------------------------------
    users_data = [
        {
            "email": "rahul@pulsebug.io",
            "full_name": "Rahul Sharma",
            "role": "DEVELOPER",
            "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
            "skills": ["authentication", "session management", "oauth", "python", "fastapi", "jwt"],
            "active_status": "AVAILABLE"
        },
        {
            "email": "priya@pulsebug.io",
            "full_name": "Priya Patel",
            "role": "DEVELOPER",
            "avatar_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
            "skills": ["frontend ui/ux", "react", "typescript", "tailwind css", "accessibility", "dashboard"],
            "active_status": "AVAILABLE"
        },
        {
            "email": "arjun@pulsebug.io",
            "full_name": "Arjun Mehta",
            "role": "DEVELOPER",
            "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
            "skills": ["billing & payments", "stripe", "database & persistence", "sql", "transactions", "checkout"],
            "active_status": "BUSY"
        },
        {
            "email": "marcus@pulsebug.io",
            "full_name": "Marcus Vance",
            "role": "DEVELOPER",
            "avatar_url": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
            "skills": ["devops & infrastructure", "kubernetes", "docker", "cloud", "telemetry", "ci/cd"],
            "active_status": "AVAILABLE"
        },
        {
            "email": "tester@pulsebug.io",
            "full_name": "Alex Wong",
            "role": "TESTER",
            "avatar_url": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
            "skills": ["qa automation", "regression testing", "cypress", "api testing", "verification"],
            "active_status": "AVAILABLE"
        },
        {
            "email": "maya@pulsebug.io",
            "full_name": "Maya Lin",
            "role": "TESTER",
            "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
            "skills": ["e2e testing", "load testing", "security audits", "manual verification"],
            "active_status": "AVAILABLE"
        }
    ]
    
    users = {}
    for u in users_data:
        existing_user = db.query(User).filter_by(email=u["email"]).first()
        if existing_user:
            users[u["email"]] = existing_user
        else:
            user_obj = User(
                email=u["email"],
                full_name=u["full_name"],
                hashed_password=get_password_hash("password123"),
                role=u["role"],
                avatar_url=u["avatar_url"],
                skills=json.dumps(u["skills"]),
                active_status=u["active_status"],
                created_at=now - timedelta(days=60)
            )
            db.add(user_obj)
            db.flush()
            users[u["email"]] = user_obj

    # ----------------------------------------------------------------------
    # 2. CREATE PROJECTS
    # ----------------------------------------------------------------------
    projects_data = [
        {
            "key": "PAY",
            "name": "NovaPay Payment Gateway",
            "description": "High-throughput payment processing engine, 3D Secure 2 authentication, subscription billing, and multi-currency payouts.",
            "lead": users["rahul@pulsebug.io"],
            "components": ["Payment Gateway", "Stripe Checkout", "Session Management", "Invoicing Service", "Fraud Detection", "API Core Gateway"],
            "environments": ["Production", "Staging", "QA", "Sandbox"]
        },
        {
            "key": "NEXUS",
            "name": "Campus Nexus Portal",
            "description": "Integrated university student lifecycle, course registration, grading portals, and active directory identity federation.",
            "lead": users["priya@pulsebug.io"],
            "components": ["Identity & Access", "Course Enrollment", "Gradebook UI", "Notifications Engine", "Student Dashboard"],
            "environments": ["Production", "Staging", "QA", "Development"]
        },
        {
            "key": "ECOM",
            "name": "Apex E-Commerce Platform",
            "description": "Global multi-vendor retail platform with live inventory reservation, recommendation search, and cart synchronization.",
            "lead": users["arjun@pulsebug.io"],
            "components": ["Product Catalog", "Cart & Checkout", "Search & Discovery", "Inventory Sync", "Order Fulfillment"],
            "environments": ["Production", "Staging", "QA"]
        },
        {
            "key": "CLOUD",
            "name": "CloudOps Infrastructure Controller",
            "description": "Kubernetes cluster orchestrator, service mesh traffic router, distributed telemetry agent, and zero-trust credential vault.",
            "lead": users["marcus@pulsebug.io"],
            "components": ["Cloud Controller", "Telemetry Collector", "Ingress Router", "Secrets Vault", "Cluster Autoscaler"],
            "environments": ["Production", "Staging", "Canary"]
        }
    ]
    
    projects = {}
    for p in projects_data:
        existing_proj = db.query(Project).filter_by(key=p["key"]).first()
        if existing_proj:
            projects[p["key"]] = existing_proj
        else:
            proj_obj = Project(
                key=p["key"],
                name=p["name"],
                description=p["description"],
                lead_id=p["lead"].id,
                components=json.dumps(p["components"]),
                environments=json.dumps(p["environments"]),
                created_at=now - timedelta(days=50)
            )
            db.add(proj_obj)
            db.flush()
            projects[p["key"]] = proj_obj

    # ----------------------------------------------------------------------
    # 3. CREATE REALISTIC BUGS (60+ across projects)
    # ----------------------------------------------------------------------
    # Seed data templates representing realistic developer pain points
    bug_templates = [
        # PAY Project Bugs
        {
            "proj": "PAY", "num": 101,
            "title": "Users are randomly logged out after refreshing the dashboard",
            "desc": "When authenticated users navigate to the billing dashboard and trigger a page refresh, the JWT session token is discarded and the user is redirected to the login view with a 401 Unauthorized status.",
            "steps": "1. Log into NovaPay dashboard with valid credentials.\n2. Navigate to /dashboard/billing.\n3. Press F5 or reload browser window.\n4. Observe sudden redirection to /login.",
            "expected": "Session cookie and token should persist across page refreshes.",
            "actual": "Local state is wiped and 401 Unauthorized causes immediate logout.",
            "cat": "Authentication", "comp": "Session Management",
            "sev": "HIGH", "prio": "P1", "impact": 88, "status": "IN_DEVELOPMENT",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "rahul@pulsebug.io",
            "labels": ["authentication", "session", "dashboard", "regression"],
            "days_ago": 2, "hours_ago": 18,
            "client_env": {"browser": "Chrome 122.0", "os": "macOS Sonoma", "screen": "2560x1440", "app_version": "v2.5.0"}
        },
        {
            "proj": "PAY", "num": 102,
            "title": "Session expires prematurely during long checkout flows",
            "desc": "Historical issue where session timeout was set to 5 minutes instead of 60 minutes, causing users on slow 3D Secure challenges to lose authentication.",
            "steps": "1. Begin checkout flow.\n2. Wait on bank OTP challenge for 6 minutes.\n3. Submit OTP.\n4. Session expiration error shown.",
            "expected": "Session timeout should be extended during active checkout transactions.",
            "actual": "Session abruptly terminates after 300 seconds.",
            "cat": "Authentication", "comp": "Session Management",
            "sev": "HIGH", "prio": "P2", "impact": 72, "status": "RESOLVED",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "rahul@pulsebug.io",
            "labels": ["authentication", "session", "historical-fix"],
            "days_ago": 24, "resolved_days_ago": 20,
            "client_env": {"browser": "Firefox 120.0", "os": "Windows 11", "screen": "1920x1080", "app_version": "v2.4.1"}
        },
        {
            "proj": "PAY", "num": 103,
            "title": "3D Secure 2.0 biometric challenge modal hangs on Safari iOS",
            "desc": "Safari WebKit fails to resolve the postMessage callback iframe from the card issuing bank, locking the customer on an infinite loading spinner.",
            "steps": "1. Open mobile checkout on iPhone 15 Safari.\n2. Enter Visa card requiring 3DS challenge.\n3. Complete FaceID on banking app.\n4. Modal stays on spinner.",
            "expected": "Webhook/postMessage should resolve and redirect to payment success page.",
            "actual": "Iframe postMessage is blocked by cross-origin security header.",
            "cat": "Billing & Payments", "comp": "Stripe Checkout",
            "sev": "CRITICAL", "prio": "P1", "impact": 94, "status": "CODE_REVIEW",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "arjun@pulsebug.io",
            "labels": ["payments", "mobile-safari", "p1-emergency", "checkout"],
            "days_ago": 1, "hours_ago": 10,
            "client_env": {"browser": "Mobile Safari 17.2", "os": "iOS 17.2", "screen": "393x852", "app_version": "v2.5.1"}
        },
        {
            "proj": "PAY", "num": 104,
            "title": "Stripe webhook retry storm creates duplicate invoice credit records",
            "desc": "When Stripe sends simultaneous duplicate webhook events during network latency, race conditions bypass the idempotency key check and insert duplicate transaction ledgers.",
            "steps": "1. Send two identical invoice.payment_succeeded webhooks within 50ms.\n2. Observe database ledger records.",
            "expected": "Database unique constraint or Redis lock should drop duplicate webhook.",
            "actual": "Both requests acquire lock and create duplicate credit lines.",
            "cat": "Billing & Payments", "comp": "Payment Gateway",
            "sev": "CRITICAL", "prio": "P1", "impact": 96, "status": "TESTING",
            "env": "Production", "reporter": "rahul@pulsebug.io", "assignee": "arjun@pulsebug.io",
            "labels": ["payments", "stripe", "idempotency", "financial-impact"],
            "days_ago": 4, "hours_ago": 6,
            "client_env": {"browser": "Server Webhook", "os": "Linux Ubuntu 22.04", "screen": "N/A", "app_version": "v2.5.0"}
        },
        {
            "proj": "PAY", "num": 105,
            "title": "Currency conversion rates round floating decimals incorrectly for JPY transactions",
            "desc": "Japanese Yen (zero-decimal currency) is multiplied by 100 before conversion, resulting in 100x overcharges on JPY payments.",
            "steps": "1. Select JPY as billing currency.\n2. Attempt to purchase item priced at 1500 JPY.\n3. Charge amount sent to gateway is 150,000 JPY.",
            "expected": "Zero-decimal currencies should not be scaled by 100 cents.",
            "actual": "Charge is sent with 2 extra decimal zeroes.",
            "cat": "Billing & Payments", "comp": "Payment Gateway",
            "sev": "CRITICAL", "prio": "P1", "impact": 99, "status": "TRIAGED",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "arjun@pulsebug.io",
            "labels": ["billing", "currency", "jpy", "data-loss"],
            "days_ago": 0, "hours_ago": 3,
            "client_env": {"browser": "Edge 121.0", "os": "Windows 11", "screen": "1920x1080", "app_version": "v2.5.1"}
        },
        {
            "proj": "PAY", "num": 106,
            "title": "Invoice PDF export text overlaps on multi-page tax breakdown tables",
            "desc": "When generating PDF invoices with more than 8 itemized tax rows, the footer page number overlaps table borders.",
            "steps": "1. Navigate to Invoices list.\n2. Select Invoice #INV-9821 with 12 items.\n3. Click 'Download PDF'.\n4. Inspect page 2 footer.",
            "expected": "Page breaks should compute table heights dynamically.",
            "actual": "Text overlaps bottom border on page 2.",
            "cat": "Frontend UI/UX", "comp": "Invoicing Service",
            "sev": "LOW", "prio": "P4", "impact": 25, "status": "ASSIGNED",
            "env": "Staging", "reporter": "tester@pulsebug.io", "assignee": "priya@pulsebug.io",
            "labels": ["ui", "pdf", "cosmetic"],
            "days_ago": 12,
            "client_env": {"browser": "Chrome 122.0", "os": "macOS Sonoma", "screen": "1920x1080", "app_version": "v2.5.0"}
        },
        {
            "proj": "PAY", "num": 107,
            "title": "API rate limiter responds with 500 Internal Error instead of 429 Too Many Requests",
            "desc": "Redis connection pool exhaustion in rate limiter middleware causes uncaught exception returning HTTP 500.",
            "steps": "1. Send 150 requests in 10 seconds with client API key.\n2. Observe HTTP response status code.",
            "expected": "HTTP 429 Too Many Requests with Retry-After header.",
            "actual": "HTTP 500 Internal Server Error with Redis Timeout exception.",
            "cat": "API & Integration", "comp": "API Core Gateway",
            "sev": "HIGH", "prio": "P2", "impact": 68, "status": "RESOLVED",
            "env": "Production", "reporter": "rahul@pulsebug.io", "assignee": "rahul@pulsebug.io",
            "labels": ["api", "rate-limiting", "redis", "gateway"],
            "days_ago": 15, "resolved_days_ago": 12,
            "client_env": {"browser": "Postman 10.22", "os": "Linux", "screen": "N/A", "app_version": "v2.4.9"}
        },
        {
            "proj": "PAY", "num": 108,
            "title": "Webhook delivery failure alerts are not dispatched to Slack channel",
            "desc": "Slack incoming webhook URL secret was revoked, stopping failed webhook alerts from notifying on-call engineers.",
            "steps": "1. Trigger simulated endpoint failure.\n2. Check #payment-alerts channel.",
            "expected": "Slack alert card should be posted immediately.",
            "actual": "Error logged in background worker: 404 webhook not found.",
            "cat": "DevOps & Infrastructure", "comp": "API Core Gateway",
            "sev": "MEDIUM", "prio": "P3", "impact": 45, "status": "VERIFIED",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "marcus@pulsebug.io",
            "labels": ["devops", "slack", "monitoring"],
            "days_ago": 18, "resolved_days_ago": 14,
            "client_env": {"browser": "Slack Desktop", "os": "macOS", "screen": "1920x1080", "app_version": "v2.4.8"}
        },
        {
            "proj": "PAY", "num": 109,
            "title": "Stale draft payment intents are never purged from PostgreSQL database",
            "desc": "Over 2.4 million abandoned payment intents remain in the database, degrading query performance on the transactions table.",
            "steps": "1. Query SELECT count(*) FROM payment_intents WHERE status = 'draft' AND created_at < NOW() - INTERVAL '30 days'.",
            "expected": "Nightly cron job should soft-delete or partition old draft intents.",
            "actual": "No cleanup cron job is running.",
            "cat": "Database & Persistence", "comp": "Payment Gateway",
            "sev": "MEDIUM", "prio": "P3", "impact": 52, "status": "IN_DEVELOPMENT",
            "env": "Production", "reporter": "rahul@pulsebug.io", "assignee": "arjun@pulsebug.io",
            "labels": ["database", "cron", "maintenance", "performance"],
            "days_ago": 35, # Demonstrates STALE bug!
            "client_env": {"browser": "pgAdmin 4", "os": "Linux", "screen": "N/A", "app_version": "v2.3.0"}
        },
        {
            "proj": "PAY", "num": 110,
            "title": "Credit card CVV field clears unexpectedly when user switches browser tab",
            "desc": "Focus loss event on the payment form triggers state reset in the React form controller, clearing the 3-digit security code.",
            "steps": "1. Enter 16-digit card number and expiry.\n2. Enter CVV.\n3. Switch to another tab to check 2FA code.\n4. Return to payment tab.",
            "expected": "CVV should stay filled in the secure input.",
            "actual": "CVV field is cleared on blur event.",
            "cat": "Frontend UI/UX", "comp": "Stripe Checkout",
            "sev": "MEDIUM", "prio": "P3", "impact": 48, "status": "CODE_REVIEW",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "priya@pulsebug.io",
            "labels": ["ui/ux", "form", "checkout"],
            "days_ago": 5, "hours_ago": 4,
            "client_env": {"browser": "Chrome 122.0", "os": "Windows 11", "screen": "1920x1080", "app_version": "v2.5.0"}
        },

        # NEXUS Project Bugs
        {
            "proj": "NEXUS", "num": 201,
            "title": "Course enrollment race condition permits exceeding maximum seat capacity",
            "desc": "During high-traffic registration window, concurrent requests bypass seat check and register 45 students into a 30-capacity lecture hall.",
            "steps": "1. Run ApacheBench concurrency test with 50 simultaneous enrollment requests on Course CS401 (1 seat remaining).\n2. Check enrolled count.",
            "expected": "Database pessimistic lock should allow exactly 1 enrollment and return 'Course Full' to the remaining 49.",
            "actual": "14 concurrent transactions read capacity > 0 and succeed.",
            "cat": "Database & Persistence", "comp": "Course Enrollment",
            "sev": "CRITICAL", "prio": "P1", "impact": 92, "status": "IN_DEVELOPMENT",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "arjun@pulsebug.io",
            "labels": ["database", "concurrency", "registration", "p1-emergency"],
            "days_ago": 2, "hours_ago": 14,
            "client_env": {"browser": "Chrome 122.0", "os": "macOS Sonoma", "screen": "1920x1080", "app_version": "v3.1.2"}
        },
        {
            "proj": "NEXUS", "num": 202,
            "title": "SAML SSO handshake fails for Faculty accounts with hyphenated surnames",
            "desc": "XML regex sanitizer strips hyphens from SAML assertion attributes, causing LDAP lookup to fail with 'User Not Found'.",
            "steps": "1. Attempt SSO login with user 'sarah-smith@university.edu'.\n2. Observe SAML relay response.",
            "expected": "User profile should map successfully with valid surname.",
            "actual": "SAML assertion parse error: 400 Bad Request.",
            "cat": "Authentication", "comp": "Identity & Access",
            "sev": "HIGH", "prio": "P2", "impact": 74, "status": "CODE_REVIEW",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "rahul@pulsebug.io",
            "labels": ["auth", "sso", "saml", "ldap"],
            "days_ago": 3, "hours_ago": 8,
            "client_env": {"browser": "Edge 121.0", "os": "Windows 11", "screen": "1920x1080", "app_version": "v3.1.2"}
        },
        {
            "proj": "NEXUS", "num": 203,
            "title": "Gradebook calculation formula computes incorrect weighted GPA when course has 0-credit lab",
            "desc": "Division by zero occurs in weighted grade aggregation when a 0-credit prerequisite lab is included in the semester transcript.",
            "steps": "1. Add a 0-credit Physics Lab to student record.\n2. Open Transcript GPA summary.\n3. GPA shows 'NaN'.",
            "expected": "0-credit courses should be excluded from denominator in GPA formula.",
            "actual": "Displays 'NaN' and breaks export to registrar PDF.",
            "cat": "Frontend UI/UX", "comp": "Gradebook UI",
            "sev": "HIGH", "prio": "P2", "impact": 78, "status": "TESTING",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "priya@pulsebug.io",
            "labels": ["grades", "calculation", "ui", "gpa"],
            "days_ago": 4, "hours_ago": 2,
            "client_env": {"browser": "Safari 17.1", "os": "macOS Sonoma", "screen": "2560x1440", "app_version": "v3.1.1"}
        },
        {
            "proj": "NEXUS", "num": 204,
            "title": "Push notification banner overflows on mobile screens under 375px width",
            "desc": "Long course announcement titles push notification dismiss button offscreen on iPhone SE.",
            "steps": "1. Open student portal on viewport width 320px-375px.\n2. Trigger course alert popup.\n3. Notice dismiss button is cut off.",
            "expected": "Banner should wrap title and keep close button visible.",
            "actual": "Horizontal scrollbar appears and button is unreachable.",
            "cat": "Frontend UI/UX", "comp": "Notifications Engine",
            "sev": "LOW", "prio": "P4", "impact": 22, "status": "RESOLVED",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "priya@pulsebug.io",
            "labels": ["ui/ux", "mobile", "responsive", "css"],
            "days_ago": 16, "resolved_days_ago": 14,
            "client_env": {"browser": "Mobile Safari", "os": "iOS 16", "screen": "375x667", "app_version": "v3.0.8"}
        },
        {
            "proj": "NEXUS", "num": 205,
            "title": "Overdue bug: Student attendance sync with biometric gate reader times out after 10 seconds",
            "desc": "Bulk sync API cannot handle 5,000 turnstile log records within the HTTP timeout limit, causing attendance records to go missing.",
            "steps": "1. Turnstile agent POSTs batch of 5,000 RFID swipes.\n2. Endpoint takes 14.2s.\n3. Hardware client disconnects on 10s timeout.",
            "expected": "Endpoint should respond in under 500ms using async batch queue.",
            "actual": "Synchronous database loop blocks worker and times out.",
            "cat": "API & Integration", "comp": "Student Dashboard",
            "sev": "HIGH", "prio": "P2", "impact": 75, "status": "IN_DEVELOPMENT",
            "env": "Production", "reporter": "rahul@pulsebug.io", "assignee": "rahul@pulsebug.io",
            "labels": ["performance", "sync", "api", "overdue"],
            "days_ago": 8, # Overdue SLA!
            "client_env": {"browser": "Hardware Gateway", "os": "Linux ARM", "screen": "N/A", "app_version": "v3.0.0"}
        },

        # ECOM Project Bugs
        {
            "proj": "ECOM", "num": 301,
            "title": "Inventory count decrements below zero when multiple shoppers checkout final stock",
            "desc": "Missing SELECT FOR UPDATE on inventory rows causes stock to reach -4 during flash sale events.",
            "steps": "1. Set stock of SKU #8819 to 1 unit.\n2. Have 3 testers click 'Place Order' at the exact same second.\n3. Check inventory table.",
            "expected": "1 order completes; remaining 2 receive 'Out of Stock' alert.",
            "actual": "All 3 orders complete; stock reaches -2.",
            "cat": "Database & Persistence", "comp": "Inventory Sync",
            "sev": "CRITICAL", "prio": "P1", "impact": 95, "status": "IN_DEVELOPMENT",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "arjun@pulsebug.io",
            "labels": ["inventory", "ecom", "database", "p1"],
            "days_ago": 1, "hours_ago": 5,
            "client_env": {"browser": "Chrome 122.0", "os": "Windows 11", "screen": "1920x1080", "app_version": "v4.2.0"}
        },
        {
            "proj": "ECOM", "num": 302,
            "title": "Elasticsearch autocomplete returns products with unpublished draft status",
            "desc": "Search query index filter does not verify `is_published=true`, leaking unreleased holiday products in search dropdown.",
            "steps": "1. Create draft product 'Secret Unreleased Drone'.\n2. Type 'Secret' into public search bar.\n3. Product appears in live suggestion dropdown.",
            "expected": "Only published items should appear in public autocomplete suggestions.",
            "actual": "Draft and archived items are exposed in search results.",
            "cat": "API & Integration", "comp": "Search & Discovery",
            "sev": "HIGH", "prio": "P2", "impact": 82, "status": "CODE_REVIEW",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "rahul@pulsebug.io",
            "labels": ["search", "elasticsearch", "security", "catalog"],
            "days_ago": 2, "hours_ago": 16,
            "client_env": {"browser": "Firefox 122.0", "os": "macOS Sonoma", "screen": "1920x1080", "app_version": "v4.2.0"}
        },
        {
            "proj": "ECOM", "num": 303,
            "title": "Dark mode styling renders product review star icons with black-on-black contrast",
            "desc": "CSS fill attribute is hardcoded to dark charcoal in dark mode theme, making star ratings invisible.",
            "steps": "1. Toggle platform into Dark Mode.\n2. Open any product review section.\n3. Look at star ratings.",
            "expected": "Star icons should display in amber/gold with high contrast against dark background.",
            "actual": "Stars are invisible black on dark gray background.",
            "cat": "Frontend UI/UX", "comp": "Product Catalog",
            "sev": "MEDIUM", "prio": "P3", "impact": 40, "status": "RESOLVED",
            "env": "Production", "reporter": "tester@pulsebug.io", "assignee": "priya@pulsebug.io",
            "labels": ["ui/ux", "dark-mode", "accessibility", "contrast"],
            "days_ago": 10, "resolved_days_ago": 8,
            "client_env": {"browser": "Chrome 122.0", "os": "macOS Sonoma", "screen": "1920x1080", "app_version": "v4.1.8"}
        },

        # CLOUD Project Bugs
        {
            "proj": "CLOUD", "num": 401,
            "title": "Kubernetes cluster autoscaler crashes on node group drain timeout",
            "desc": "Go panic in worker loop occurs when AWS EC2 spot instance termination notice arrives while pod eviction is in progress.",
            "steps": "1. Trigger spot instance termination simulation.\n2. Observe autoscaler pod logs.",
            "expected": "Graceful pod drain with 30s grace period and clean node detach.",
            "actual": "Autoscaler controller crashes with SIGSEGV null pointer dereference.",
            "cat": "DevOps & Infrastructure", "comp": "Cloud Controller",
            "sev": "CRITICAL", "prio": "P1", "impact": 97, "status": "IN_DEVELOPMENT",
            "env": "Production", "reporter": "rahul@pulsebug.io", "assignee": "marcus@pulsebug.io",
            "labels": ["k8s", "autoscaler", "devops", "cloud", "p1"],
            "days_ago": 1, "hours_ago": 12,
            "client_env": {"browser": "kubectl v1.29", "os": "Linux Amazon Linux 2", "screen": "N/A", "app_version": "v1.8.4"}
        },
        {
            "proj": "CLOUD", "num": 402,
            "title": "Vault token automatic renewal fails on replica cluster during leader failover",
            "desc": "Telemetry agent secrets client fails to reconnect to Vault standby cluster after active node restart.",
            "steps": "1. Perform Vault active node failover.\n2. Monitor telemetry client token renewal logs.",
            "expected": "Client should follow redirect header to new Vault leader.",
            "actual": "Token expires and metrics collection drops to 0.",
            "cat": "DevOps & Infrastructure", "comp": "Secrets Vault",
            "sev": "HIGH", "prio": "P2", "impact": 79, "status": "TESTING",
            "env": "Production", "reporter": "rahul@pulsebug.io", "assignee": "marcus@pulsebug.io",
            "labels": ["vault", "security", "telemetry", "infrastructure"],
            "days_ago": 3, "hours_ago": 20,
            "client_env": {"browser": "CLI Agent", "os": "Debian 12", "screen": "N/A", "app_version": "v1.8.3"}
        }
    ]

    # Additional programmatic variations to reach 65+ realistic bugs
    categories_pool = [
        ("Authentication", "Session Management", ["rahul@pulsebug.io", "priya@pulsebug.io"]),
        ("Billing & Payments", "Payment Gateway", ["arjun@pulsebug.io"]),
        ("Frontend UI/UX", "Dashboard UI", ["priya@pulsebug.io"]),
        ("Database & Persistence", "Query Optimizer", ["arjun@pulsebug.io"]),
        ("DevOps & Infrastructure", "Cloud Controller", ["marcus@pulsebug.io"]),
        ("API & Integration", "API Core Gateway", ["rahul@pulsebug.io", "marcus@pulsebug.io"])
    ]
    
    statuses_pool = ["NEW", "TRIAGED", "ASSIGNED", "IN_DEVELOPMENT", "CODE_REVIEW", "TESTING", "RESOLVED", "VERIFIED", "CLOSED"]
    severities_pool = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    priorities_pool = ["P1", "P2", "P3", "P4"]

    created_bugs = []
    
    # Insert main hand-crafted templates first
    for t in bug_templates:
        proj = projects[t["proj"]]
        reporter = users[t["reporter"]]
        assignee = users[t["assignee"]] if t.get("assignee") else None
        
        bug_key = f"{proj.key}-{t['num']}"
        existing_bug = db.query(Bug).filter_by(bug_key=bug_key).first()
        if existing_bug:
            created_bugs.append(existing_bug)
            continue
        
        created_time = now - timedelta(days=t.get("days_ago", 5), hours=t.get("hours_ago", 0))
        resolved_time = now - timedelta(days=t.get("resolved_days_ago", 2)) if t.get("resolved_days_ago") else None
        due_date = calculate_sla_due_date(t["prio"], created_time)
        
        sla_info = evaluate_sla_status(created_time, due_date, t["status"], resolved_time)
        
        bug = Bug(
            bug_key=bug_key,
            project_id=proj.id,
            title=t["title"],
            description=t["desc"],
            steps_to_reproduce=t["steps"],
            expected_behavior=t["expected"],
            actual_behavior=t["actual"],
            category=t["cat"],
            component=t["comp"],
            severity=t["sev"],
            priority=t["prio"],
            impact_score=t["impact"],
            status=t["status"],
            environment=t["env"],
            reporter_id=reporter.id,
            assignee_id=assignee.id if assignee else None,
            labels=json.dumps(t["labels"]),
            is_security_sensitive=t["sev"] == "CRITICAL" and "security" in t["labels"],
            is_stale=sla_info["is_stale"],
            sla_due_date=due_date,
            sla_breached=sla_info["sla_breached"],
            technical_context=json.dumps(t["client_env"]),
            quality_score=random.randint(82, 98),
            created_at=created_time,
            updated_at=now - timedelta(hours=random.randint(1, 12)),
            resolved_at=resolved_time,
            closed_at=resolved_time if t["status"] in ["VERIFIED", "CLOSED"] else None
        )
        db.add(bug)
        db.flush()
        created_bugs.append(bug)

    # Generate additional rich bugs to satisfy comprehensive dataset
    for i in range(111, 160):
        proj_key = random.choice(["PAY", "NEXUS", "ECOM", "CLOUD"])
        proj = projects[proj_key]
        cat, comp, assigned_dev_emails = random.choice(categories_pool)
        assignee_email = random.choice(assigned_dev_emails)
        assignee = users[assignee_email]
        reporter = users["tester@pulsebug.io"]
        
        sev = random.choices(severities_pool, weights=[15, 30, 40, 15])[0]
        prio = "P1" if sev == "CRITICAL" else ("P2" if sev == "HIGH" else ("P3" if sev == "MEDIUM" else "P4"))
        status = random.choices(statuses_pool, weights=[10, 15, 15, 25, 10, 10, 10, 3, 2])[0]
        
        days_ago = random.randint(1, 45)
        created_time = now - timedelta(days=days_ago, hours=random.randint(1, 23))
        resolved_time = (created_time + timedelta(days=random.randint(1, 4))) if status in ["RESOLVED", "VERIFIED", "CLOSED"] else None
        due_date = calculate_sla_due_date(prio, created_time)
        sla_info = evaluate_sla_status(created_time, due_date, status, resolved_time)
        
        impact = 85 if prio == "P1" else (70 if prio == "P2" else (50 if prio == "P3" else 30))
        impact += random.randint(-8, 8)
        
        titles = [
            f"Intermittent timeout on {comp} during batch synchronization",
            f"Memory utilization spikes in {comp} under sustained load",
            f"Null reference exception when loading {comp} on iOS client",
            f"Dropdown select item fails keyboard TAB navigation in {comp}",
            f"Missing localization string for German and Japanese in {comp}",
            f"Cache invalidation delay causes stale display on {comp}",
            f"Broken link in error state modal inside {comp}",
            f"HTTP 504 Gateway Timeout during peak hours on {comp}"
        ]
        chosen_title = random.choice(titles)
        
        bug_key = f"{proj.key}-{i}"
        existing_bug = db.query(Bug).filter_by(bug_key=bug_key).first()
        if existing_bug:
            created_bugs.append(existing_bug)
            continue
            
        bug = Bug(
            bug_key=bug_key,
            project_id=proj.id,
            title=chosen_title,
            description=f"Automated test suite and user reports indicate an issue with {comp}. {chosen_title}. Observed repeatedly under normal traffic conditions.",
            steps_to_reproduce=f"1. Navigate to {comp}.\n2. Trigger normal action.\n3. Notice unexpected failure or slowdown.",
            expected_behavior=f"System should execute {comp} smoothly within SLA.",
            actual_behavior=f"Fails or exhibits unexpected behavior in {comp}.",
            category=cat,
            component=comp,
            severity=sev,
            priority=prio,
            impact_score=min(max(impact, 15), 98),
            status=status,
            environment=random.choice(["Production", "Staging", "QA"]),
            reporter_id=reporter.id,
            assignee_id=assignee.id if status != "NEW" else None,
            labels=json.dumps([cat.lower().split()[0], comp.lower().replace(" ", "-"), "automated"]),
            is_security_sensitive=sev == "CRITICAL" and random.random() < 0.3,
            is_stale=sla_info["is_stale"],
            sla_due_date=due_date,
            sla_breached=sla_info["sla_breached"],
            technical_context=json.dumps({"browser": "Chrome 122", "os": "Windows 11", "app_version": "v2.5.0"}),
            quality_score=random.randint(70, 95),
            created_at=created_time,
            updated_at=now - timedelta(hours=random.randint(1, 24)),
            resolved_at=resolved_time,
            closed_at=resolved_time if status in ["VERIFIED", "CLOSED"] else None
        )
        db.add(bug)
        db.flush()
        created_bugs.append(bug)

    # ----------------------------------------------------------------------
    # 4. CREATE RELATIONS & REGRESSIONS
    # ----------------------------------------------------------------------
    # Link PAY-101 as a regression of PAY-102!
    pay_101 = next((b for b in created_bugs if b.bug_key == "PAY-101"), None)
    pay_102 = next((b for b in created_bugs if b.bug_key == "PAY-102"), None)
    pay_103 = next((b for b in created_bugs if b.bug_key == "PAY-103"), None)
    pay_104 = next((b for b in created_bugs if b.bug_key == "PAY-104"), None)
    
    if pay_101 and pay_102:
        rel1 = BugRelation(
            source_bug_id=pay_101.id,
            target_bug_id=pay_102.id,
            relation_type="REGRESSION_OF",
            created_at=now - timedelta(hours=18)
        )
        db.add(rel1)
        
    if pay_104 and pay_103:
        rel2 = BugRelation(
            source_bug_id=pay_104.id,
            target_bug_id=pay_103.id,
            relation_type="BLOCKS",
            created_at=now - timedelta(days=2)
        )
        db.add(rel2)

    # ----------------------------------------------------------------------
    # 5. CREATE GIT INTEGRATIONS & PRs
    # ----------------------------------------------------------------------
    if pay_101:
        git1 = GitIntegration(
            bug_id=pay_101.id,
            branch_name="fix/pay-101-session-cookie-refresh",
            commit_sha="83ab921",
            commit_message="fix(auth): preserve jwt refresh cookie on client window reload",
            pr_number=74,
            pr_title="Fix PAY-101: Session expires on dashboard reload",
            pr_status="OPEN",
            author="Rahul Sharma",
            url="https://github.com/novapay/gateway/pull/74",
            created_at=now - timedelta(hours=12)
        )
        db.add(git1)

    if pay_103:
        git2 = GitIntegration(
            bug_id=pay_103.id,
            branch_name="fix/pay-103-safari-3ds-iframe",
            commit_sha="c4e8901",
            commit_message="fix(checkout): add allow-same-origin sandbox to 3DS iframe",
            pr_number=88,
            pr_title="Fix PAY-103: Safari 3DS Biometric Handshake",
            pr_status="APPROVED",
            author="Arjun Mehta",
            url="https://github.com/novapay/gateway/pull/88",
            created_at=now - timedelta(hours=8)
        )
        db.add(git2)

    if pay_104:
        git3 = GitIntegration(
            bug_id=pay_104.id,
            branch_name="fix/pay-104-webhook-idempotency-lock",
            commit_sha="a921d7b",
            commit_message="fix(stripe): acquire distributed redis lock before invoice processing",
            pr_number=92,
            pr_title="Fix PAY-104: Webhook Idempotency Lock",
            pr_status="MERGED",
            author="Arjun Mehta",
            url="https://github.com/novapay/gateway/pull/92",
            created_at=now - timedelta(hours=4)
        )
        db.add(git3)

    # ----------------------------------------------------------------------
    # 6. CREATE COMMENTS & THREADED DISCUSSIONS
    # ----------------------------------------------------------------------
    if pay_101:
        c1 = Comment(
            bug_id=pay_101.id,
            author_id=users["rahul@pulsebug.io"].id,
            content="@Sarah @Alex I've traced the issue down to the `SameSite=Strict` cookie header being dropped on SPA hard-refreshes. Working on branch `fix/pay-101-session-cookie-refresh` now.",
            is_resolved=False,
            created_at=now - timedelta(hours=14)
        )
        db.add(c1)
        db.flush()
        
        c2 = Comment(
            bug_id=pay_101.id,
            author_id=users["tester@pulsebug.io"].id,
            parent_id=c1.id,
            content="Confirmed. I tested against Safari 17.2 and Chrome 122, both fail identically. Let me know as soon as the PR is deployed to Staging.",
            is_resolved=True,
            created_at=now - timedelta(hours=10)
        )
        db.add(c2)

    if pay_103:
        c3 = Comment(
            bug_id=pay_103.id,
            author_id=users["arjun@pulsebug.io"].id,
            content="PR #88 is up with the iframe sandbox policy fix. Can someone verify on physical iOS 17 device?",
            is_resolved=False,
            created_at=now - timedelta(hours=6)
        )
        db.add(c3)

    # ----------------------------------------------------------------------
    # 7. CREATE AUDIT LOGS
    # ----------------------------------------------------------------------
    if pay_101:
        db.add(AuditLog(
            bug_id=pay_101.id,
            user_id=users["tester@pulsebug.io"].id,
            user_name="David Clark",
            action="CREATED",
            old_value=None,
            new_value="NEW",
            reason="Initial bug report submitted via portal",
            timestamp=now - timedelta(hours=18)
        ))
        db.add(AuditLog(
            bug_id=pay_101.id,
            user_id=None,
            user_name="AI Triage Engine",
            action="AI_TRIAGE",
            field_name="category",
            old_value="General",
            new_value="Authentication",
            reason="AI Classified: 91% confidence for Session Management domain",
            timestamp=now - timedelta(hours=17, minutes=58)
        ))
        db.add(AuditLog(
            bug_id=pay_101.id,
            user_id=users["tester@pulsebug.io"].id,
            user_name="Sarah Jenkins",
            action="ASSIGNED",
            field_name="assignee",
            old_value=None,
            new_value="Rahul Sharma",
            reason="Accepted AI Recommendation: Rahul has high authentication domain expertise",
            timestamp=now - timedelta(hours=16)
        ))
        db.add(AuditLog(
            bug_id=pay_101.id,
            user_id=users["rahul@pulsebug.io"].id,
            user_name="Rahul Sharma",
            action="STATUS_CHANGED",
            field_name="status",
            old_value="ASSIGNED",
            new_value="IN_DEVELOPMENT",
            reason="Branch fix/pay-101-session-cookie-refresh checked out",
            timestamp=now - timedelta(hours=14)
        ))

    # ----------------------------------------------------------------------
    # 8. CREATE NOTIFICATIONS
    # ----------------------------------------------------------------------
    for user_obj in users.values():
        db.add(Notification(
            user_id=user_obj.id,
            type="ASSIGNED" if user_obj.role == "DEVELOPER" else "SLA_WARNING",
            title=f"Welcome to PulseBug Platform, {user_obj.full_name}",
            message="System initialized with real-time intelligence engines and active projects.",
            is_read=False,
            created_at=now - timedelta(hours=1)
        ))
        
    db.commit()
    print("Database successfully seeded with 65+ realistic issues, projects, and users!")
