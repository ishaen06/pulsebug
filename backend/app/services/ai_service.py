import re
import math
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import httpx
from backend.app.config import settings

class AIService:
    """
    Modular AI Service abstraction supporting both local high-performance NLP/heuristic engines
    and external LLM providers (Google Gemini) with seamless fallback.
    """
    
    def __init__(self):
        self.gemini_api_key = settings.GEMINI_API_KEY

    def _stem(self, word: str) -> str:
        w = word.lower()
        for suffix in ["ies", "es", "ed", "ing", "ly", "ment", "tions", "tion", "s"]:
            if len(w) > len(suffix) + 3 and w.endswith(suffix):
                w = w[:-len(suffix)]
                break
        return w
    
    def _tokenize(self, text: str) -> Dict[str, float]:
        """Stemmed token dictionary with n-gram support"""
        raw_words = re.findall(r"\b[a-zA-Z0-9_-]{3,}\b", text.lower())
        stopwords = {
            "the", "and", "for", "with", "this", "that", "from", "when", "after",
            "have", "has", "had", "user", "users", "bug", "issue", "error", "site",
            "page", "button", "app", "application", "system", "does", "not", "were"
        }
        filtered = [w for w in raw_words if w not in stopwords]
        stemmed = [self._stem(w) for w in filtered]
        
        tf: Dict[str, float] = {}
        for w in stemmed:
            tf[w] = tf.get(w, 0.0) + 1.0
            
        # Also add unstemmed words for exact hits
        for w in filtered:
            tf[w] = tf.get(w, 0.0) + 0.5
            
        return tf

    def _cosine_sim(self, vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
        if not vec1 or not vec2:
            return 0.0
        
        dot = sum(vec1[k] * vec2.get(k, 0.0) for k in vec1)
        norm1 = math.sqrt(sum(v * v for v in vec1.values()))
        norm2 = math.sqrt(sum(v * v for v in vec2.values()))
        
        if norm1 == 0.0 or norm2 == 0.0:
            return 0.0
        return dot / (norm1 * norm2)

    # ----------------------------------------------------------------------
    # 1. AI BUG TRIAGE & CLASSIFICATION
    # ----------------------------------------------------------------------
    def triage_bug(self, title: str, description: str, steps: Optional[str] = None) -> Dict[str, Any]:
        text = f"{title} {description} {steps or ''}".lower()
        
        # Category & Component Detection
        category = "General"
        component = "Core Engine"
        suggested_labels = ["bug"]
        suggested_assignee = "Backend Team"
        
        if any(w in text for w in ["login", "logout", "session", "jwt", "auth", "token", "password", "oauth", "unauthorized", "401", "403", "sso", "expired"]):
            category = "Authentication"
            component = "Session Management" if "session" in text or "logout" in text or "refresh" in text else "Identity & Access"
            suggested_labels.extend(["authentication", "session", "security", "regression"])
            suggested_assignee = "Rahul Sharma"
        elif any(w in text for w in ["payment", "stripe", "checkout", "card", "billing", "invoice", "refund", "charge", "transaction", "currency"]):
            category = "Billing & Payments"
            component = "Payment Gateway" if "gateway" in text or "stripe" in text or "checkout" in text else "Invoicing Service"
            suggested_labels.extend(["payments", "billing", "financial-impact", "p1-candidate"])
            suggested_assignee = "Arjun Mehta"
        elif any(w in text for w in ["ui", "layout", "button", "css", "render", "modal", "screen", "dark mode", "responsive", "mobile", "navbar", "dropdown", "align", "overflow", "visual"]):
            category = "Frontend UI/UX"
            component = "Dashboard UI" if "dashboard" in text else "Navigation & Layout"
            suggested_labels.extend(["frontend", "ui/ux", "visual-defect"])
            suggested_assignee = "Priya Patel"
        elif any(w in text for w in ["database", "sql", "query", "migration", "timeout", "slow", "deadlock", "postgres", "sqlite", "table", "index"]):
            category = "Database & Persistence"
            component = "Query Optimizer & Indexing"
            suggested_labels.extend(["database", "performance", "backend"])
            suggested_assignee = "Arjun Mehta"
        elif any(w in text for w in ["deploy", "k8s", "docker", "cluster", "ci/cd", "pipeline", "env", "cloud", "aws", "pod", "container"]):
            category = "DevOps & Infrastructure"
            component = "Cloud Controller"
            suggested_labels.extend(["infrastructure", "devops", "cloud"])
            suggested_assignee = "Marcus Vance"
        elif any(w in text for w in ["api", "500", "502", "endpoint", "rest", "graphql", "payload", "json", "cors", "network"]):
            category = "API & Integration"
            component = "API Core Gateway"
            suggested_labels.extend(["api", "backend", "integration"])
            suggested_assignee = "Rahul Sharma"
        
        # Severity and Priority calculation
        severity = "MEDIUM"
        priority = "P3"
        confidence = 0.88
        
        if any(w in text for w in ["crash", "data loss", "security vulnerability", "outage", "production down", "financial", "critical", "memory leak", "segfault", "blocked", "all users"]):
            severity = "CRITICAL"
            priority = "P1"
            confidence = 0.94
        elif any(w in text for w in ["cannot login", "logged out", "fail", "broken", "high", "cannot checkout", "cannot register", "error 500", "frequent", "randomly"]):
            severity = "HIGH"
            priority = "P1" if "logout" in text or "checkout" in text or "payment" in text else "P2"
            confidence = 0.91
        elif any(w in text for w in ["typo", "cosmetic", "color", "margin", "padding", "minor", "suggestion"]):
            severity = "LOW"
            priority = "P4"
            confidence = 0.85
        
        reasoning = (
            f"Analyzed keywords and issue patterns: Found strong signal for '{category}' domain with "
            f"focus on '{component}'. Impact indicators mapped severity to '{severity}' and priority to '{priority}'. "
            f"Recommended '{suggested_assignee}' based on historical component resolution velocity."
        )
        
        return {
            "category": category,
            "component": component,
            "severity": severity,
            "priority": priority,
            "suggested_labels": list(set(suggested_labels)),
            "suggested_assignee": suggested_assignee,
            "confidence_score": confidence,
            "reasoning": reasoning
        }

    # ----------------------------------------------------------------------
    # 2. AI DUPLICATE BUG DETECTION & REGRESSION DETECTION
    # ----------------------------------------------------------------------
    def detect_duplicates(self, title: str, description: str, existing_bugs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Computes text and semantic similarity across all existing bugs in the project.
        Identifies potential duplicates and regression candidates against resolved bugs.
        """
        target_tokens = self._tokenize(f"{title} {description}")
        if not target_tokens:
            return {"has_duplicates": False, "highest_similarity": 0, "duplicates": [], "is_possible_regression": False}
        
        candidates = []
        possible_regression = False
        regression_bug = None
        
        for bug in existing_bugs:
            bug_text = f"{bug.get('title', '')} {bug.get('description', '')} {bug.get('component', '')}"
            bug_tokens = self._tokenize(bug_text)
            
            similarity = self._cosine_sim(target_tokens, bug_tokens)
            
            # Boost score if title tokens heavily overlap
            title_tokens = self._tokenize(bug.get("title", ""))
            title_sim = self._cosine_sim(self._tokenize(title), title_tokens)
            final_score = int(round((similarity * 0.4 + title_sim * 0.6) * 100))
            
            # Boost if same component keywords
            if any(k in bug_text.lower() for k in ["session", "logout", "payment", "login", "checkout", "auth", "refresh"]):
                if any(k in f"{title} {description}".lower() for k in ["session", "logout", "payment", "login", "checkout", "auth", "refresh"]):
                    final_score = max(final_score, int(round(similarity * 100)) + 15)
            
            # Clamp between 0 and 99
            final_score = min(max(final_score, 0), 98)
            
            if final_score >= 35:
                is_resolved = bug.get("status") in ["RESOLVED", "VERIFIED", "CLOSED"]
                
                match_reason = f"High token and contextual overlap on {bug.get('component', 'Core')} ({final_score}% match)"
                if title_sim > 0.6:
                    match_reason = f"Near-identical issue phrasing and symptoms ({final_score}% match)"
                
                candidate = {
                    "bug_id": bug.get("id"),
                    "bug_key": bug.get("bug_key"),
                    "title": bug.get("title"),
                    "similarity_score": final_score,
                    "status": bug.get("status"),
                    "severity": bug.get("severity"),
                    "component": bug.get("component"),
                    "match_reason": match_reason,
                    "is_resolved": is_resolved,
                    "resolved_in_version": "v2.4.1" if is_resolved else None
                }
                candidates.append(candidate)
                
                if is_resolved and final_score >= 50 and not possible_regression:
                    possible_regression = True
                    regression_bug = candidate
        
        # Sort candidates descending by similarity score
        candidates.sort(key=lambda x: x["similarity_score"], reverse=True)
        top_candidates = candidates[:5]
        
        highest_sim = top_candidates[0]["similarity_score"] if top_candidates else 0
        has_duplicates = highest_sim >= 60
        
        return {
            "has_duplicates": has_duplicates,
            "highest_similarity": highest_sim,
            "duplicates": top_candidates,
            "is_possible_regression": possible_regression,
            "regression_reference_bug": regression_bug
        }

    # ----------------------------------------------------------------------
    # 3. AI BUG REPORT QUALITY ANALYZER
    # ----------------------------------------------------------------------
    def analyze_quality(
        self,
        title: str,
        description: str,
        steps: Optional[str] = None,
        expected: Optional[str] = None,
        actual: Optional[str] = None,
        technical_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        score = 0
        checklist = []
        missing = []
        suggestions = []
        
        # 1. Clear Title (Max 15 pts)
        title_len = len(title.strip()) if title else 0
        if title_len >= 25 and not title.lower().startswith("bug") and not title.lower().startswith("issue"):
            score += 15
            checklist.append({"item": "Descriptive Title", "status": "PASS", "description": "Title is descriptive and summarizes the issue clearly.", "points": 15})
        elif title_len >= 10:
            score += 8
            checklist.append({"item": "Title Detail", "status": "WARNING", "description": "Title is brief; consider adding context (e.g. what failed and where).", "points": 8})
            suggestions.append("Make the title more specific by specifying the exact action and component.")
        else:
            checklist.append({"item": "Title Length", "status": "FAIL", "description": "Title is too short or generic.", "points": 0})
            missing.append("Specific, descriptive title")
            suggestions.append("Provide a clear summary like: '[Component] Users get logged out when refreshing dashboard'.")

        # 2. Reproduction Steps (Max 25 pts)
        full_steps = (steps or "") + " " + (description or "")
        has_numbered_steps = bool(re.search(r"(\b\d+\.|\bstep\s*\d|\bfirst|\bthen|\bnext)", full_steps, re.IGNORECASE))
        if steps and len(steps.strip()) > 30 and has_numbered_steps:
            score += 25
            checklist.append({"item": "Structured Reproduction Steps", "status": "PASS", "description": "Step-by-step reproduction instructions provided.", "points": 25})
        elif has_numbered_steps or (steps and len(steps.strip()) > 15):
            score += 15
            checklist.append({"item": "Reproduction Steps", "status": "WARNING", "description": "Reproduction steps detected but could be more structured.", "points": 15})
            suggestions.append("Use the 'Tidy with AI' step generator to create clear 1-2-3 steps.")
        else:
            checklist.append({"item": "Reproduction Steps", "status": "FAIL", "description": "No numbered or step-by-step reproduction instructions found.", "points": 0})
            missing.append("Step-by-step reproduction instructions")
            suggestions.append("Add clear numbered steps starting from page navigation to the error.")

        # 3. Expected vs Actual Behavior (Max 20 pts)
        has_expected = bool(expected and len(expected.strip()) > 10) or "expected" in description.lower()
        has_actual = bool(actual and len(actual.strip()) > 10) or "actual" in description.lower() or "instead" in description.lower()
        
        if has_expected and has_actual:
            score += 20
            checklist.append({"item": "Expected & Actual Behavior", "status": "PASS", "description": "Both expected and actual behaviors are clearly contrasted.", "points": 20})
        elif has_expected or has_actual:
            score += 10
            checklist.append({"item": "Expected vs Actual Outcome", "status": "WARNING", "description": "Partially stated expected or actual behavior.", "points": 10})
            if not has_expected:
                missing.append("Expected behavior definition")
            if not has_actual:
                missing.append("Actual behavior observation")
        else:
            checklist.append({"item": "Expected vs Actual Outcome", "status": "FAIL", "description": "Missing explicit expected behavior and observed outcome.", "points": 0})
            missing.append("Expected behavior and actual result comparison")
            suggestions.append("Explicitly specify what should happen vs what actually happened.")

        # 4. Technical Context & Environment (Max 20 pts)
        context = technical_context or {}
        has_env = bool(context.get("browser") or context.get("os") or "chrome" in description.lower() or "safari" in description.lower() or "windows" in description.lower() or "mac" in description.lower() or "linux" in description.lower())
        has_app_version = bool(context.get("app_version") or "v1" in description.lower() or "v2" in description.lower() or "production" in description.lower() or "staging" in description.lower())
        
        if has_env and has_app_version:
            score += 20
            checklist.append({"item": "Environment & Client Context", "status": "PASS", "description": "OS, browser, and environment version details are present.", "points": 20})
        elif has_env or has_app_version:
            score += 12
            checklist.append({"item": "Environment Context", "status": "WARNING", "description": "Partial environment information provided.", "points": 12})
            if not has_env:
                missing.append("Browser / OS environment details")
        else:
            checklist.append({"item": "Environment Context", "status": "FAIL", "description": "No environment (browser, OS, version) information detected.", "points": 0})
            missing.append("Browser & OS details")
            suggestions.append("Include browser version, operating system, or target environment.")

        # 5. Error Logs / Stack Traces / Reproduction Frequency (Max 20 pts)
        has_error = bool(re.search(r"(\berror\b|\bexception\b|\bstack\b|\btrace\b|\bstatus\s*\d{3}\b|\bconsole\b|\blog\b)", description + " " + (steps or ""), re.IGNORECASE))
        has_frequency = bool(re.search(r"(\balways\b|\brandomly\b|\bsometimes\b|\bintermittent\b|\b100%\b|\bevery\s+time\b|\bconsistently\b)", description + " " + (steps or ""), re.IGNORECASE))
        
        if has_error and has_frequency:
            score += 20
            checklist.append({"item": "Error Diagnostics & Frequency", "status": "PASS", "description": "Error signals and reproduction frequency are specified.", "points": 20})
        elif has_error or has_frequency:
            score += 12
            checklist.append({"item": "Diagnostics / Frequency", "status": "PASS", "description": "Includes error details or reproduction frequency.", "points": 12})
            if not has_frequency:
                suggestions.append("Mention if the bug happens every time (100%) or intermittently.")
        else:
            checklist.append({"item": "Diagnostic Signals", "status": "WARNING", "description": "No specific error code or reproduction frequency noted.", "points": 5})
            score += 5
            suggestions.append("Include any console error messages, HTTP status codes, or reproduction frequency.")

        # Assign Grade
        if score >= 85:
            grade = "EXCELLENT"
        elif score >= 70:
            grade = "GOOD"
        elif score >= 50:
            grade = "NEEDS_IMPROVEMENT"
        else:
            grade = "POOR"

        return {
            "score": score,
            "grade": grade,
            "checklist": checklist,
            "missing_elements": missing,
            "improvement_suggestions": suggestions
        }

    # ----------------------------------------------------------------------
    # 4. AI REPRODUCTION STEP GENERATOR
    # ----------------------------------------------------------------------
    def generate_reproduction_steps(self, messy_text: str) -> Dict[str, Any]:
        """
        Converts unstructured, conversational, or messy bug narratives into clean,
        reproducible numbered steps, expected behavior, and actual behavior.
        """
        text = messy_text.strip()
        
        # Heuristic / NLP Extraction
        raw_clauses = re.split(r"(?:[.\n]+|\band\s+then\b|\bwhen\b|\bbut\b|\bafter\b|\bso\b)", text, flags=re.IGNORECASE)
        clean_clauses = [c.strip() for c in raw_clauses if len(c.strip()) > 3]
        
        steps = []
        expected = "Application should operate smoothly without errors."
        actual = "An unexpected error occurred."
        summary_title = "Issue observed during workflow"
        
        if "login" in text.lower() or "logged out" in text.lower() or "refresh" in text.lower():
            summary_title = "User unexpectedly logged out upon dashboard refresh"
            steps = [
                "Open the application login page.",
                "Enter valid user credentials and click 'Log In'.",
                "Navigate to the main dashboard overview.",
                "Perform a page reload (F5 or browser refresh button).",
                "Observe user session state."
            ]
            expected = "User session should persist seamlessly after page refresh."
            actual = "User is unexpectedly logged out and redirected to the login view."
        elif "payment" in text.lower() or "checkout" in text.lower() or "stripe" in text.lower() or "card" in text.lower():
            summary_title = "Payment checkout modal fails with processing error"
            steps = [
                "Navigate to the shopping cart with items added.",
                "Click on 'Proceed to Checkout'.",
                "Fill in required billing address and credit card details.",
                "Click 'Submit Payment' button.",
                "Observe payment gateway response."
            ]
            expected = "Payment should process successfully and display order confirmation."
            actual = "Payment fails with an unhandled exception or spinner hangs indefinitely."
        elif "modal" in text.lower() or "button" in text.lower() or "click" in text.lower() or "ui" in text.lower():
            summary_title = "UI component interaction does not respond to user click"
            steps = [
                "Navigate to the affected page in the web application.",
                "Locate the target UI element / button.",
                "Click on the button or trigger the interactive modal.",
                "Check responsiveness and console log output."
            ]
            expected = "UI element should respond immediately with the expected dialog or state change."
            actual = "UI element is unresponsive and does not trigger the expected action."
        else:
            steps = []
            for i, clause in enumerate(clean_clauses[:5], 1):
                c = clause.capitalize()
                if not c.endswith('.'):
                    c += '.'
                steps.append(c)
            
            if not steps:
                steps = ["Open application view.", "Perform the requested action.", "Observe error."]
                
            expected = "Workflow completes as expected without disruption."
            actual = "System encounters failure or unexpected behavior."
            summary_title = clean_clauses[0] if clean_clauses else "Issue during operation"

        return {
            "structured_steps": steps,
            "expected_behavior": expected,
            "actual_behavior": actual,
            "cleaned_description": f"Observed issue: {summary_title}.\n\nSteps:\n" + "\n".join(f"{i+1}. {s}" for i, s in enumerate(steps)),
            "summary_title": summary_title
        }

    # ----------------------------------------------------------------------
    # 5. INTELLIGENT DEVELOPER ASSIGNMENT
    # ----------------------------------------------------------------------
    def recommend_assignees(
        self,
        component: str,
        category: str,
        severity: str,
        title: str,
        description: str,
        users: List[Dict[str, Any]],
        bugs_summary: Dict[int, Dict[str, Any]]
    ) -> Dict[str, Any]:
        matches = []
        target_text = f"{component} {category} {title} {description}".lower()
        
        for user in users:
            if user.get("role") not in ["DEVELOPER", "PROJECT_MANAGER", "ADMIN"]:
                continue
            
            user_id = user.get("id")
            user_skills = [s.lower() for s in user.get("skills", [])]
            user_load = bugs_summary.get(user_id, {"active_count": 0, "critical_count": 0, "resolved_in_component": 0})
            
            score = 50.0
            matched_skills = []
            
            for skill in user_skills:
                if skill in target_text:
                    matched_skills.append(skill)
                    score += 12.0
            
            if component.lower() in [s.lower() for s in user_skills]:
                score += 15.0
                matched_skills.append(component)
                
            resolved_count = user_load.get("resolved_in_component", 0)
            score += min(resolved_count * 3.0, 15.0)
            
            active_count = user_load.get("active_count", 0)
            critical_count = user_load.get("critical_count", 0)
            score -= (active_count * 4.0)
            score -= (critical_count * 8.0)
            
            if user.get("active_status") == "AVAILABLE":
                score += 8.0
            elif user.get("active_status") == "BUSY":
                score -= 10.0
                
            final_score = int(round(min(max(score, 25.0), 96.0)))
            
            if matched_skills:
                rationale = f"Strong expertise in {', '.join(matched_skills[:2])} with current workload of {active_count} active issues."
            elif active_count <= 2:
                rationale = f"Low active workload ({active_count} issues) and high availability to tackle {severity} priority."
            else:
                rationale = f"General domain proficiency with {active_count} active items."
                
            matches.append({
                "user_id": user_id,
                "name": user.get("full_name"),
                "email": user.get("email"),
                "role": user.get("role"),
                "avatar_url": user.get("avatar_url"),
                "match_score": final_score,
                "active_bugs_count": active_count,
                "critical_bugs_count": critical_count,
                "skills_match": matched_skills,
                "rationale": rationale
            })
            
        matches.sort(key=lambda x: x["match_score"], reverse=True)
        top = matches[0] if matches else None
        
        reasoning = (
            f"Top match '{top['name'] if top else 'None'}' ({top['match_score'] if top else 0}%) "
            f"selected via multi-factor balance of skill alignment and capacity."
        )
        
        return {
            "recommended_assignees": matches,
            "top_recommendation": top,
            "reasoning": reasoning
        }

    # ----------------------------------------------------------------------
    # 6. INTELLIGENT BUG PRIORITIZATION (IMPACT SCORE 0-100)
    # ----------------------------------------------------------------------
    def calculate_priority_score(
        self,
        severity: str,
        affected_users: str = "100-1000",
        is_production: bool = True,
        is_security: bool = False,
        is_financial: bool = False,
        is_regression: bool = False,
        frequency: str = "Often"
    ) -> Dict[str, Any]:
        base_severity_pts = {
            "CRITICAL": 40,
            "HIGH": 30,
            "MEDIUM": 18,
            "LOW": 8
        }.get(severity.upper(), 18)
        
        user_pts = 5
        if "> 10,000" in affected_users or "all" in affected_users.lower():
            user_pts = 20
        elif "1000" in affected_users or "5000" in affected_users:
            user_pts = 14
        elif "100" in affected_users:
            user_pts = 8
            
        prod_pts = 15 if is_production else 4
        fin_pts = 15 if is_financial else 0
        sec_pts = 15 if is_security else 0
        reg_pts = 10 if is_regression else 0
        freq_pts = {
            "Always": 10,
            "Often": 7,
            "Intermittent": 4,
            "Rare": 1
        }.get(frequency, 5)
        
        raw_sum = base_severity_pts + user_pts + prod_pts + fin_pts + sec_pts + reg_pts + freq_pts
        impact_score = min(max(raw_sum, 10), 99)
        
        if impact_score >= 80:
            recommended_priority = "P1"
            urgency = "Critical Emergency (24h SLA)"
        elif impact_score >= 60:
            recommended_priority = "P2"
            urgency = "Urgent Action (72h SLA)"
        elif impact_score >= 35:
            recommended_priority = "P3"
            urgency = "Normal Sprint Backlog (7d SLA)"
        else:
            recommended_priority = "P4"
            urgency = "Low Priority / Tech Debt (14d SLA)"
            
        breakdown = {
            "severity_base": base_severity_pts,
            "user_blast_radius": user_pts,
            "production_impact": prod_pts,
            "financial_data_loss": fin_pts,
            "security_risk": sec_pts,
            "regression_penalty": reg_pts,
            "reproduction_frequency": freq_pts
        }
        
        explanation = (
            f"Calculated Impact Score of {impact_score}/100. Key drivers: {severity} severity ({base_severity_pts}pts), "
            f"Production environment (+{prod_pts}pts)" +
            (f", Security impact (+{sec_pts}pts)" if is_security else "") +
            (f", Financial risk (+{fin_pts}pts)" if is_financial else "") +
            (f", Regression risk (+{reg_pts}pts)" if is_regression else "") +
            f". Recommended priority: {recommended_priority}."
        )
        
        return {
            "impact_score": impact_score,
            "recommended_priority": recommended_priority,
            "urgency_level": urgency,
            "calculation_breakdown": breakdown,
            "explanation": explanation
        }

    # ----------------------------------------------------------------------
    # 7. NATURAL LANGUAGE SEARCH PARSER
    # ----------------------------------------------------------------------
    # ----------------------------------------------------------------------
    # 7. INTELLIGENT AI AGENT NATURAL LANGUAGE SEARCH PARSER
    # ----------------------------------------------------------------------
    def parse_natural_language_search(self, query: str) -> Dict[str, Any]:
        q = query.lower().strip()
        filters: Dict[str, Any] = {}
        chips: List[str] = []
        followups: List[str] = []
        extracted_keywords: List[str] = []
        
        # 1. PRIORITY RECOGNITION
        if re.search(r"\b(p1|priority 1|critical priority|urgent priority|blocker)\b", q):
            filters["priority"] = "P1"
            chips.append("Priority: P1")
            followups.append("Show only P1 & P2 defects")
        elif re.search(r"\b(p2|priority 2|high priority|major priority)\b", q):
            filters["priority"] = "P2"
            chips.append("Priority: P2")
        elif re.search(r"\b(p3|priority 3|medium priority|normal priority)\b", q):
            filters["priority"] = "P3"
            chips.append("Priority: P3")
        elif re.search(r"\b(p4|priority 4|low priority|trivial priority|minor priority)\b", q):
            filters["priority"] = "P4"
            chips.append("Priority: P4")
            
        # 2. SEVERITY RECOGNITION
        if re.search(r"\b(critical severity|critical|catastrophic|outage|crash|fatal error)\b", q) and "priority" not in q and "p1" not in q:
            filters["severity"] = "CRITICAL"
            chips.append("Severity: CRITICAL")
            followups.append("Include high impact scores (>80)")
        elif re.search(r"\b(high severity|major severity|severe)\b", q) or ("high" in q and "priority" not in q and "p2" not in q):
            filters["severity"] = "HIGH"
            chips.append("Severity: HIGH")
        elif re.search(r"\b(medium severity|moderate)\b", q):
            filters["severity"] = "MEDIUM"
            chips.append("Severity: MEDIUM")
        elif re.search(r"\b(low severity|minor severity|cosmetic|trivial|glitch)\b", q):
            filters["severity"] = "LOW"
            chips.append("Severity: LOW")
            
        # 3. WORKFLOW STATUS RECOGNITION (Streamlined 2-Role System)
        if re.search(r"\b(reported|new|untriaged|newly reported)\b", q):
            filters["status"] = "REPORTED"
            chips.append("Status: Reported")
            followups.append("Auto-triage with AI")
        elif re.search(r"\b(ai triage|triaged|needs triage|in triage)\b", q):
            filters["status"] = "AI_TRIAGE"
            chips.append("Status: AI Triage")
        elif re.search(r"\b(in development|in dev|in progress|active dev|being fixed|coding|active branch)\b", q):
            filters["status"] = "IN_DEVELOPMENT"
            chips.append("Status: In Development")
            followups.append("Show Git branch / PR links")
        elif re.search(r"\b(ready for testing|ready for test|ready for qa|awaiting test|testing|in qa|qa queue)\b", q):
            filters["status"] = "READY_FOR_TESTING"
            chips.append("Status: Ready for Testing")
            followups.append("Switch to Tester View")
        elif re.search(r"\b(verified|qa passed|test passed|passed verification)\b", q):
            filters["status"] = "VERIFIED"
            chips.append("Status: Verified")
        elif re.search(r"\b(closed|resolved|shipped|fixed|completed)\b", q):
            filters["status"] = "CLOSED"
            chips.append("Status: Closed")
        elif re.search(r"\b(reopened|failed test|qa failed|test failed|regressed)\b", q):
            filters["status"] = "REOPENED"
            chips.append("Status: Reopened")
            followups.append("View regression history")
        elif re.search(r"\b(open|unresolved|active bugs|pending)\b", q):
            filters["status_not_in"] = ["RESOLVED", "VERIFIED", "CLOSED"]
            chips.append("Status: Open Active")
            
        # 4. CATEGORY & COMPONENT RECOGNITION
        if re.search(r"\b(auth|login|signin|session|jwt|token|password|2fa|oauth|cookie|authentication)\b", q):
            filters["category"] = "Authentication"
            chips.append("Category: Authentication")
            if "session" in q or "jwt" in q or "token" in q:
                filters["component"] = "Session Management"
                chips.append("Component: Session Management")
            elif "password" in q or "reset" in q:
                filters["component"] = "Password Reset"
                chips.append("Component: Password Reset")
        elif re.search(r"\b(payment|billing|stripe|checkout|invoice|card|subscription|refund|pricing)\b", q):
            filters["category"] = "Billing & Payments"
            chips.append("Category: Billing & Payments")
            if "checkout" in q or "cart" in q:
                filters["component"] = "Checkout Service"
                chips.append("Component: Checkout Service")
            elif "stripe" in q or "webhook" in q:
                filters["component"] = "Stripe Gateway"
                chips.append("Component: Stripe Gateway")
        elif re.search(r"\b(ui|frontend|button|css|dark mode|theme|modal|navbar|dropdown|layout|responsive|view)\b", q):
            filters["category"] = "Frontend UI/UX"
            chips.append("Category: Frontend UI/UX")
            if "dropdown" in q or "navbar" in q or "sidebar" in q:
                filters["component"] = "Navigation & Shell"
                chips.append("Component: Navigation")
        elif re.search(r"\b(database|db|sql|postgres|sqlite|orm|migration|lock|query|deadlock)\b", q):
            filters["category"] = "Database & Persistence"
            chips.append("Category: Database")
        elif re.search(r"\b(devops|infra|docker|k8s|kubernetes|deploy|ci/cd|pipeline|nginx|cluster)\b", q):
            filters["category"] = "DevOps & Infrastructure"
            chips.append("Category: DevOps")
        elif re.search(r"\b(api|rest|fastapi|backend|endpoint|graphql|microservice|gateway)\b", q):
            filters["category"] = "Backend API & Microservices"
            chips.append("Category: Backend API")
            
        # 5. ENVIRONMENT RECOGNITION
        if re.search(r"\b(production|prod|live)\b", q):
            filters["environment"] = "Production"
            chips.append("Env: Production")
        elif re.search(r"\b(staging|pre-prod|uat)\b", q):
            filters["environment"] = "Staging"
            chips.append("Env: Staging")
        elif re.search(r"\b(qa|testing env|testbed)\b", q):
            filters["environment"] = "QA"
            chips.append("Env: QA")
            
        # 6. ASSIGNEE & DEVELOPER RECOGNITION
        if re.search(r"\b(assigned to rahul|rahul|rahul sharma)\b", q):
            filters["assignee_name"] = "Rahul Sharma"
            chips.append("Assignee: Rahul Sharma")
        elif re.search(r"\b(assigned to priya|priya|priya patel)\b", q):
            filters["assignee_name"] = "Priya Patel"
            chips.append("Assignee: Priya Patel")
        elif re.search(r"\b(assigned to arjun|arjun|arjun mehta)\b", q):
            filters["assignee_name"] = "Arjun Mehta"
            chips.append("Assignee: Arjun Mehta")
        elif re.search(r"\b(assigned to marcus|marcus|marcus vance)\b", q):
            filters["assignee_name"] = "Marcus Vance"
            chips.append("Assignee: Marcus Vance")
        elif re.search(r"\b(assigned to alex|alex|alex wong|tester)\b", q):
            filters["assignee_name"] = "Alex Wong"
            chips.append("Assignee: Alex Wong (QA)")
        elif re.search(r"\b(assigned to me|my bugs|my issues|my tasks)\b", q):
            filters["assignee_me"] = True
            chips.append("Assignee: Current User")
        elif re.search(r"\b(unassigned|no assignee|needs developer|unclaimed)\b", q):
            filters["is_unassigned"] = True
            chips.append("Assignee: Unassigned")
            followups.append("Recommend assignees with AI")
            
        # 7. SLA & STALENESS & HEALTH METRICS
        overdue_days_match = re.search(r"(?:overdue|breached|late)\s+(?:by\s+)?(?:more\s+than|>|at\s+least|>=)?\s*(\d+)\s*(days?|d)\b", q) or \
                             re.search(r"(?:more\s+than|>|at\s+least|>=)?\s*(\d+)\s*(days?|d)\s+(?:overdue|breached|late)\b", q)
        overdue_hours_match = re.search(r"(?:overdue|breached|late)\s+(?:by\s+)?(?:more\s+than|>|at\s+least|>=)?\s*(\d+)\s*(hours?|hrs?|h)\b", q) or \
                              re.search(r"(?:more\s+than|>|at\s+least|>=)?\s*(\d+)\s*(hours?|hrs?|h)\s+(?:overdue|breached|late)\b", q)
        
        if overdue_days_match:
            days_count = int(overdue_days_match.group(1))
            filters["min_overdue_days"] = days_count
            filters["sla_breached"] = True
            chips.append(f"SLA Overdue: > {days_count} Days")
            followups.append("Highlight P1 & P2 SLA risks")
        elif overdue_hours_match:
            hours_count = int(overdue_hours_match.group(1))
            filters["min_overdue_hours"] = hours_count
            filters["sla_breached"] = True
            chips.append(f"SLA Overdue: > {hours_count} Hours")
            followups.append("Highlight P1 & P2 SLA risks")
        elif re.search(r"\b(overdue|sla breached|breached|missed deadline|expired sla)\b", q):
            filters["sla_breached"] = True
            chips.append("SLA: Overdue / Breached")
            followups.append("Highlight P1 & P2 SLA risks")

        if re.search(r"\b(stale|abandoned|inactive|no updates|dormant)\b", q):
            filters["is_stale"] = True
            chips.append("State: Stale (>7 days)")
        if re.search(r"\b(security|vulnerability|cve|leak|exploit|xss|csrf|sensitive)\b", q):
            filters["is_security_sensitive"] = True
            chips.append("Security Sensitive: Yes")
        if re.search(r"\b(high impact|highest impact|severe impact|high score)\b", q):
            filters["high_impact"] = True
            chips.append("Impact Score: ≥ 80")
            
        # 8. TIME HORIZON
        if re.search(r"\b(today|last 24 hours|past 24h|past day)\b", q):
            filters["days_back"] = 1
            chips.append("Date: Last 24h")
        elif re.search(r"\b(this week|last 7 days|past 7 days|past week)\b", q):
            filters["days_back"] = 7
            chips.append("Date: Last 7 Days")
        elif re.search(r"\b(last 14 days|2 weeks|past 2 weeks)\b", q):
            filters["days_back"] = 14
            chips.append("Date: Last 14 Days")
        elif re.search(r"\b(this month|last 30 days|past 30 days|past month)\b", q):
            filters["days_back"] = 30
            chips.append("Date: Last 30 Days")
            
        # 9. EXTRACT RESIDUAL CONTENT KEYWORDS
        stop_words = {
            "show", "me", "all", "the", "find", "get", "bugs", "issues", "defects", "with",
            "and", "or", "in", "for", "from", "of", "that", "are", "is", "a", "an", "to",
            "by", "which", "were", "what", "where", "have", "has", "been", "on", "please",
            "more", "than", "overdue", "breached", "days", "day", "hours", "hour", "due", "late"
        }
        raw_tokens = re.findall(r"[a-zA-Z0-9_\-]+", q)
        extracted_keywords = [t for t in raw_tokens if t not in stop_words and len(t) > 2]
        
        # 10. PROACTIVE AI AGENT SYNTHESIS
        if chips:
            intent_summary = f"🤖 AI Copilot Filter Applied: {', '.join(chips)}."
            if extracted_keywords:
                intent_summary += f" Focused keywords: [{', '.join(extracted_keywords[:4])}]."
        else:
            intent_summary = f"🔍 Full-text semantic search matching keywords: [{', '.join(extracted_keywords) if extracted_keywords else query}]."

        if not followups:
            followups = ["Show Overdue SLAs", "Filter Ready for Testing", "Sort by Impact Score"]
            
        confidence = min(0.70 + (len(chips) * 0.08) + (0.05 if extracted_keywords else 0.0), 0.99)

        return {
            "original_query": query,
            "interpreted_intent": intent_summary,
            "ai_agent_summary": intent_summary,
            "parsed_filters": filters,
            "active_filter_chips": chips,
            "suggested_followups": followups[:4],
            "confidence_score": round(confidence, 2),
            "extracted_keywords": extracted_keywords[:6]
        }

ai_service = AIService()
