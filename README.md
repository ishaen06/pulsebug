# PulseBug 2.0 — Modern Intelligent Bug Tracking & Developer Collaboration Platform

> **"Instead of simply recording bugs, the system helps engineering teams understand, prioritize, assign, resolve, verify and learn from bugs."**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.141-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-v4.3-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Python 3.14](https://img.shields.io/badge/Python-3.14-3776AB.svg?logo=python&logoColor=white)](https://www.python.org)
[![WebSockets](https://img.shields.io/badge/WebSockets-Real--Time-010101.svg?logo=socket.io&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![Tests Passing](https://img.shields.io/badge/Tests-9%20Passed-10b981.svg)]()

---

## 1. Problem Statement & Legacy Deconstruction

Traditional bug trackers (such as Bugzilla, Trac, and legacy Jira configurations) were architected around **record storage** rather than **active developer productivity**. Engineering teams face significant friction:

| Legacy Bug Tracking Pain Point | How PulseBug 2.0 Reconstructs the Experience |
| :--- | :--- |
| **Dense, table-heavy UI** with high cognitive load and poor contrast | Clean, minimalist, dark/light developer-first UI inspired by modern engineering tools (Linear, GitHub Issues) with instant theme toggle and WCAG AA contrast. |
| **Messy, low-quality bug submissions** missing reproduction steps, browser versions, and expected outcomes | **Live AI Report Quality Analyzer (0–100)** with real-time checklist and actionable suggestions before submission. |
| **Duplicate bug overload** creating backlog noise | **Live AI Duplicate & Regression Scanner** computing semantic and token similarity against active and resolved issues. |
| **Ambiguous or manual triage** where PMs spend hours classifying category, component, and priority | **AI Bug Triage Engine** that recommends Category, Component, Severity, Priority, Labels, and Assignee with clear reasoning. |
| **Random developer assignment** ignoring domain expertise and current capacity | **Intelligent Assignee Matcher** scoring developers by expertise, historical resolved components, and workload. |
| **Disconnected from Git code repositories** requiring manual ticket updates | **GitHub PR Lifecycle Integration** with automated status transitions (`pr_opened` → `CODE_REVIEW`, `pr_merged` → `TESTING`). |
| **Silent bug regressions** repeating resolved defects without historical traceability | **Automatic Regression Detection** that detects similarities to previously resolved bugs and links lineage. |
| **Unclear team velocity and hidden bottlenecks** | **Project Health Engine (0–100)** and visual Dependency Graph identifying critical blockers. |

---

## 2. System Architecture

PulseBug is structured with clean separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            REACT 19 + VITE FRONTEND                         │
│  • Modern Developer UI (Linear / GitHub Issues inspired)                    │
│  • Dark Mode & Light Mode (Instant toggle, WCAG AA compliant)               │
│  • Real-Time WebSockets (Status changes, comments, live presence)           │
│  • Intelligent Bug Creator (Live Quality Score, Duplicate Drawer, AI Triage)│
│  • Interactive Git Simulator & Visual Dependency Graph                      │
│  • Role-based Navigation (Admin, PM, Developer, QA Tester, Reporter)        │
│  • Executive / PM / Developer / QA Analytics Dashboards                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST API + WebSockets (/api/v1, /ws)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                             FASTAPI BACKEND                                 │
│  • Auth & RBAC Middleware (JWT tokens, role permissions)                    │
│  • Workflow Engine (NEW -> TRIAGED -> ASSIGNED -> IN_DEV -> PR -> RESOLVED) │
│  • Git Integration Service (Webhook & PR simulation engine)                 │
│  • SLA & Stale Bug Monitor (P1 24h, P2 72h, P3 7d, P4 14d, Stale > 30d)     │
│  • Audit Trail & Activity Timeline Service                                  │
│  • Search Engine (Natural Language Query Parser -> Structured Filters)      │
│  • Real-Time WebSocket Connection Manager                                   │
└──────────────────┬────────────────────────────────────────┬─────────────────┘
                   │                                        │
┌──────────────────▼──────────────────┐   ┌─────────────────▼─────────────────┐
│        AI INTELLIGENCE LAYER        │   │        SQL DATABASE LAYER         │
│  • Multi-Provider AIService Adapter │   │  • SQLite / SQLAlchemy Async ORM  │
│  • Bug Triage & Classification      │   │  • Proper indexes on status,      │
│  • Vector/TF-IDF Duplicate Detector │   │    priority, project, assignee    │
│  • Report Quality Analyzer (0-100)  │   │  • Normalized models: Users, Bugs,│
│  • Reproduction Step Generator      │   │    Projects, Comments, AuditLogs, │
│  • Multi-Factor Assignee Matcher    │   │    GitIntegrations, Relations     │
│  • Impact Prioritization Engine     │   │  • Realistic Seed Data (65+ bugs) │
└─────────────────────────────────────┘   └───────────────────────────────────┘
```

---

## 3. Key Innovations & Intelligent Engines

### 1. AI Bug Triage Engine (`/api/v1/ai/triage`)
- Analyzes bug title, description, and steps to infer:
  - **Category** (e.g. Authentication, Billing, Frontend, Database, DevOps, API)
  - **Component** (e.g. Session Management, Payment Gateway, Dashboard UI)
  - **Severity & Priority** (P1 Critical, P2 High, P3 Medium, P4 Low)
  - **Suggested Labels & Assignee**
- **Non-destructive**: User can review, modify, or apply granular recommendations. AI never silently overwrites user intent.

### 2. AI Duplicate Bug Detection & Regression Linker (`/api/v1/ai/duplicate-check`)
- Compares text and morphological tokens against all project issues.
- Displays match similarity percentage (e.g. `91% similarity with PAY-102`).
- Identifies **Possible Regressions** against resolved bugs (e.g. "Similar to PAY-102 resolved in v2.4.1").

### 3. AI Bug Report Quality Analyzer (`/api/v1/ai/quality-score`)
- Dynamically computes a **0–100 score** and grade (`EXCELLENT`, `GOOD`, `NEEDS_IMPROVEMENT`, `POOR`).
- Evaluates:
  1. Clear, non-generic title (15 pts)
  2. Numbered reproduction steps (25 pts)
  3. Expected vs Actual outcome contrast (20 pts)
  4. Environment & client context (20 pts)
  5. Diagnostics / stack trace / frequency (20 pts)
- Lists missing elements and actionable suggestions before submission.

### 4. AI Reproduction Step Generator ("Tidy with AI") (`/api/v1/ai/reproduction-steps`)
- Converts messy, unstructured narratives into structured 1-2-3 numbered steps, expected behavior, and actual behavior.

### 5. Intelligent Developer Assignment (`/api/v1/ai/recommend-assignee`)
- Multi-factor match ranking (e.g. Rahul Sharma 94%, Priya Patel 87%) computed from:
  - Component skill alignment (35 pts)
  - Historical bugs resolved in component (15 pts)
  - Active backlog penalty (-4 pts per active issue, -8 pts per critical issue)
  - Availability status bonus/penalty
- Provides explainable rationale (e.g. *"Strong expertise in authentication + currently has low active workload"*).

### 6. GitHub / Git Lifecycle Automation (`/api/v1/git/simulate/{id}`)
- Seamless development activity tracking:
  - Branch Created → Bug moves to `IN_DEVELOPMENT`
  - PR Opened → Bug moves to `CODE_REVIEW`
  - Review Approved → PR marked `APPROVED`
  - PR Merged → Bug automatically moves to `TESTING` for QA verification
  - Release Deployed → Bug marked `VERIFIED`

### 7. Project Health Engine (`/api/v1/analytics/project/{id}/health`)
- Computes overall project health score (0–100) and grade (A/B/C/D).
- Calculates root-cause diagnostic penalties for critical open issues, SLA breaches, elevated regression rates, and stale bugs.

### 8. SLA & Stale Bug Monitor
- Configurable SLA thresholds:
  - **P1**: 24 Hours
  - **P2**: 72 Hours (3 Days)
  - **P3**: 7 Days
  - **P4**: 14 Days
- Live countdown pill with visual warning indicators and automated stale detection (> 30 days inactive).

### 9. Smart Natural Language Search (`/api/v1/ai/nl-search`)
- Converts conversational queries like *"Show critical authentication bugs from last 30 days"* into structured filter tags.

## 4. Core Capabilities Overview

- **Full Defect Lifecycle Management**: End-to-end bug tracking (`OPEN` → `IN_DEV` → `CODE_REVIEW` → `QA_TESTING` → `VERIFIED` → `CLOSED`), threaded discussions, file attachments, and immutable audit logs.
- **Workflow State Machine**: Automated Git state transitions linked with branches, PRs, merges, and deployments.
- **Real-Time Collaboration**: WebSocket broadcasts delivering live desktop notifications across engineering teams.
- **Enterprise Security**: Role-based access control, cryptographic SHA-256 password security, JWT bearer authorization, and 6-digit email OTP verification.
- **Stability & SLA Analytics**: Quantitative Project Health Engine (0–100) and SLA countdown timers across P1–P4 priorities.
- **High-Performance Full-Stack Architecture**: Async FastAPI backend with SQLAlchemy and MongoDB Atlas support paired with a modern Vite + React 18 frontend.

---

## 5. User Roles & Access Control (RBAC)

PulseBug operates with **2 focused engineering roles**: **Developer** and **Tester**.

### Roles & Permissions Matrix
| Action / Capability | Developer | Tester |
| :--- | :---: | :---: |
| **Report a Bug** | ✅ | ✅ |
| **View bugs & details** | ✅ | ✅ |
| **Add comments & discussions** | ✅ | ✅ |
| **Attach screenshots & logs** | ✅ | ✅ |
| **View bug timeline & audit history** | ✅ | ✅ |
| **View AI triage & duplicate suggestions** | ✅ | ✅ |
| **Accept assigned bugs** | ✅ | ❌ |
| **Transition to "In Development"** | ✅ | ❌ |
| **Add reproduction/fix details** | ✅ | ❌ |
| **Link commits, branches, PRs** | ✅ | ❌ |
| **Mark bug as "Ready for Testing"** | ✅ | ❌ |
| **View "Ready for Testing" queue** | ✅ | ✅ |
| **Add QA test results & evidence** | ❌ | ✅ |
| **Mark Verified → Closed** | ❌ | ✅ |
| **Mark Test Failed → Reopened** | ❌ | ✅ |

### Bug Lifecycle Workflow
```
Reported ──► AI Triage ──► In Development ──► Ready for Testing ──► Verified ──► Closed
                                ▲                    │
                                └─── Reopened ◄──────┘ (If testing fails)
```

> **Demo Tip:** Use the Role Switcher in the top-right navbar to instantly toggle between **Developer** (`rahul@pulsebug.io`) and **Tester** (`tester@pulsebug.io`) personas!

---

## 6. Interactive Feature Walkthrough (10 Steps)

Follow the 10-step walkthrough to experience the platform capabilities:

1. **Step 1 — Project Health Dashboard**: Open Analytics page. Review live Health Score (e.g. 78/100), Critical defects count, Overdue SLAs, and diagnostic root cause warnings.
2. **Step 2 — Create a Messy Bug Report**: Click **Report Issue**. Type: *"I opened the site and login worked but when I refreshed the dashboard it logged me out."*
3. **Step 3 — Inspect AI Bug Quality Score**: Watch the real-time Quality meter update (e.g. 45/100) with missing elements (reproduction steps, expected outcome, browser details).
4. **Step 4 — Review Duplicate & Regression Alerts**: Notice the top banner alerting to a 90%+ similarity match with historical defect `#102`.
5. **Step 5 — Run AI Triage & Step Generator**: Click **Tidy with AI** to structure numbered steps and **Auto-Triage with AI** to suggest `Authentication`, `Session Management`, `P1 Critical`. Click **Apply All** and submit.
6. **Step 6 — Inspect Intelligent Assignee Matching**: Open the newly created issue. Review Recommended Assignees showing Rahul Sharma (94% match) with domain reasoning. Click **Assign**.
7. **Step 7 — Examine Single Source of Truth**: View the unified page: SLA timer pill, expected vs actual outcome cards, threaded comments, and immutable audit trail.
8. **Step 8 — Simulate GitHub PR Workflow**: In the GitHub Activity Card, click **Merge PR (→ QA TESTING)**. Watch the bug automatically transition from `IN_DEVELOPMENT` to `TESTING` with audit trail recording.
9. **Step 9 — Verify Historical Regression Link**: Inspect the regression trace link connecting the issue back to `#102` resolved in `v2.4.1`.
10. **Step 10 — Return to Analytics**: Observe updated project resolution velocity, SLA meters, and revised project health metrics!

---

## 7. Database Schema & Entities

The relational database is normalized with SQLite / SQLAlchemy Async ORM:

```
┌──────────────────┐       1:N       ┌──────────────────┐
│      users       │ ─────────────── │      bugs        │
│  (id, email,     │                 │  (id, bug_key,   │
│   role, skills)  │                 │   title, status, │
└──────────────────┘                 │   priority, sla) │
         │                           └─────────┬────────┘
         │ 1:N                                 │
         ▼                                     ├────────────────────────┐
┌──────────────────┐                           │ 1:N                    │ 1:N
│     projects     │                           ▼                        ▼
│  (id, key, name, │                 ┌──────────────────┐     ┌──────────────────┐
│   components)    │                 │     comments     │     │  git_integrations│
└──────────────────┘                 │  (id, content,   │     │  (id, branch,    │
                                     │   parent_id,     │     │   commit, pr_num,│
                                     │   is_resolved)   │     │   pr_status)     │
                                     └──────────────────┘     └──────────────────┘
                                               │                        │
                                               │ 1:N                    │ 1:N
                                               ▼                        ▼
                                     ┌──────────────────┐     ┌──────────────────┐
                                     │    audit_logs    │     │  bug_relations   │
                                     │  (id, action,    │     │  (source_bug_id, │
                                     │   old_value,     │     │   target_bug_id, │
                                     │   new_value)     │     │   relation_type) │
                                     └──────────────────┘     └──────────────────┘
```

---

## 8. API Documentation Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | JWT Authentication login |
| `GET` | `/api/v1/auth/me` | Current authenticated user profile |
| `POST` | `/api/v1/auth/switch-demo-user/{email}` | Instant demo role switcher |
| `GET` | `/api/v1/projects` | List all projects with bug counts |
| `GET` | `/api/v1/bugs` | List issues with rich multi-facet filters & pagination |
| `POST` | `/api/v1/bugs` | Create bug with automatic SLA calculation & quality scoring |
| `GET` | `/api/v1/bugs/{id}` | Complete bug detail (relations, git, audit logs, comments) |
| `PATCH` | `/api/v1/bugs/{id}` | Update bug status with workflow state machine validation |
| `POST` | `/api/v1/bugs/{id}/relations` | Link dependencies (`BLOCKS`, `REGRESSION_OF`, etc.) |
| `POST` | `/api/v1/bugs/{id}/comments` | Add threaded comment with @mentions parsing |
| `PATCH` | `/api/v1/comments/{id}` | Edit comment or toggle resolution state |
| `POST` | `/api/v1/ai/triage` | AI Bug classification & triage engine |
| `POST` | `/api/v1/ai/duplicate-check` | Semantic duplicate & regression scanner |
| `POST` | `/api/v1/ai/quality-score` | Bug report quality score (0–100) & missing items checklist |
| `POST` | `/api/v1/ai/reproduction-steps`| Converts messy text to structured numbered reproduction steps |
| `POST` | `/api/v1/ai/recommend-assignee`| Multi-factor developer matching engine |
| `POST` | `/api/v1/ai/prioritize` | Computes objective 0–100 Impact Score |
| `POST` | `/api/v1/ai/nl-search` | Translates natural language queries into structured filters |
| `POST` | `/api/v1/git/simulate/{id}` | Simulates GitHub PR events with automated status transitions |
| `GET` | `/api/v1/analytics/project/{id}/health` | Project Health Engine stability score & diagnostics |
| `GET` | `/api/v1/analytics/manager` | Engineering Manager dashboard metrics |
| `GET` | `/api/v1/analytics/developer` | Developer personal workload & queue |
| `GET` | `/api/v1/analytics/qa` | QA testing & verification queue |
| `POST` | `/api/v1/auth/forgot-password` | Initiates rate-limited password reset with generic security response |
| `POST` | `/api/v1/auth/verify-reset-token` | Verifies cryptographic token validity, expiration & single-use |
| `POST` | `/api/v1/auth/reset-password` | Updates password and invalidates token immediately |
| `WS` | `/api/v1/ws` | Real-time WebSocket connection for live event broadcasts |

---

## 9. Getting Started & Running the Project

### Prerequisites
- Python 3.10+ (Python 3.14 supported)
- Node.js 18+ & npm

### 1-Click Startup (Windows PowerShell)
```powershell
.\start.ps1
```

### Manual Startup

#### 1. Backend Server
```bash
# Activate virtual environment
.\venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend runs on `http://127.0.0.1:8000` (API Docs at `http://127.0.0.1:8000/docs`).*

#### 2. Frontend Client
```bash
cd frontend
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 10. Running Automated Tests

```bash
.\venv\Scripts\python.exe -m pytest backend/tests/test_backend.py
```
Output:
```
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.1.1
collected 9 items

backend/tests/test_backend.py .........                                  [100%]
============================== 9 passed in 1.46s ==============================
```

---

## 11. Future Scope

1. **Native GitHub App & Webhook Receiver**: Ingest live webhook payloads from GitHub Enterprise repositories.
2. **Predictive Root-Cause Clustering**: Train transformer models on stack traces and log dumps for automatic failure clustering.
3. **IDE Integration (VS Code / JetBrains Sidecar)**: View assigned bugs and trigger branch checkouts directly inside the developer's code editor.
4. **CI/CD Flaky Test Regression Correlation**: Correlate recurring test failures in GitHub Actions / Jenkins with open bug regressions.
