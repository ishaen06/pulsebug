from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class AITriageRequest(BaseModel):
    title: str
    description: str
    steps_to_reproduce: Optional[str] = None
    project_id: Optional[int] = None

class AITriageResponse(BaseModel):
    category: str
    component: str
    severity: str
    priority: str
    suggested_labels: List[str]
    suggested_assignee: Optional[str] = None
    suggested_assignee_id: Optional[int] = None
    confidence_score: float
    reasoning: str
    raw_analysis: Optional[Dict[str, Any]] = None

class AIDuplicateCheckRequest(BaseModel):
    title: str
    description: str
    project_id: Optional[int] = None
    exclude_bug_id: Optional[int] = None

class DuplicateCandidate(BaseModel):
    bug_id: int
    bug_key: str
    title: str
    similarity_score: int  # percentage (e.g. 91)
    status: str
    severity: str
    component: str
    match_reason: str
    is_resolved: bool
    resolved_in_version: Optional[str] = None

class AIDuplicateCheckResponse(BaseModel):
    has_duplicates: bool
    highest_similarity: int
    duplicates: List[DuplicateCandidate]
    is_possible_regression: bool
    regression_reference_bug: Optional[DuplicateCandidate] = None

class AIQualityScoreRequest(BaseModel):
    title: str
    description: str
    steps_to_reproduce: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    technical_context: Optional[Dict[str, Any]] = None

class QualityCheckItem(BaseModel):
    item: str
    status: str  # "PASS", "FAIL", "WARNING"
    description: str
    points: int

class AIQualityScoreResponse(BaseModel):
    score: int  # 0 to 100
    grade: str  # "EXCELLENT", "GOOD", "NEEDS_IMPROVEMENT", "POOR"
    checklist: List[QualityCheckItem]
    missing_elements: List[str]
    improvement_suggestions: List[str]

class AIReproductionStepsRequest(BaseModel):
    messy_description: str

class AIReproductionStepsResponse(BaseModel):
    structured_steps: List[str]
    expected_behavior: str
    actual_behavior: str
    cleaned_description: str
    summary_title: Optional[str] = None

class AssigneeMatch(BaseModel):
    user_id: int
    name: str
    email: str
    role: str
    avatar_url: Optional[str] = None
    match_score: int  # percentage 0 to 100
    active_bugs_count: int
    critical_bugs_count: int
    skills_match: List[str]
    rationale: str

class AIAssigneeRecommendRequest(BaseModel):
    component: str
    category: str
    severity: str
    title: str
    description: str
    project_id: Optional[int] = None

class AIAssigneeRecommendResponse(BaseModel):
    recommended_assignees: List[AssigneeMatch]
    top_recommendation: Optional[AssigneeMatch] = None
    reasoning: str

class AIPrioritizeRequest(BaseModel):
    severity: str
    affected_users_estimate: Optional[str] = "100-1000"
    is_production: Optional[bool] = True
    is_security_impact: Optional[bool] = False
    is_financial_or_data_loss: Optional[bool] = False
    is_regression: Optional[bool] = False
    frequency: Optional[str] = "Often"  # Always, Often, Intermittent, Rare

class AIPrioritizeResponse(BaseModel):
    impact_score: int  # 0 to 100
    recommended_priority: str  # P1, P2, P3, P4
    urgency_level: str  # Critical Emergency, Urgent Action, Normal Sprint, Backlog
    calculation_breakdown: Dict[str, int]
    explanation: str

class AINLSearchRequest(BaseModel):
    query: str

class AINLSearchResponse(BaseModel):
    original_query: str
    interpreted_intent: str
    ai_agent_summary: Optional[str] = None
    parsed_filters: Dict[str, Any]
    active_filter_chips: List[str]
    suggested_followups: Optional[List[str]] = []
    confidence_score: Optional[float] = 0.95
    extracted_keywords: Optional[List[str]] = []

