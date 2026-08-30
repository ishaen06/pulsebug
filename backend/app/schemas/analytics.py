from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class HealthFactor(BaseModel):
    factor_name: str
    impact_weight: int
    status: str  # "GOOD", "WARNING", "CRITICAL"
    score_contribution: int
    diagnostic_message: str

class ProjectHealthResponse(BaseModel):
    project_id: int
    project_name: str
    project_key: str
    overall_health_score: int  # 0 to 100
    health_grade: str          # "EXCELLENT (A)", "STABLE (B)", "AT RISK (C)", "CRITICAL (D)"
    critical_open_bugs: int
    overdue_sla_bugs: int
    regression_rate: float     # percentage e.g. 8.2
    avg_resolution_time_days: float
    stale_bugs_count: int
    total_open_bugs: int
    total_resolved_bugs: int
    resolution_velocity_per_week: float
    health_factors: List[HealthFactor]
    root_cause_warnings: List[str]

class TimeSeriesPoint(BaseModel):
    date: str
    opened: int
    resolved: int
    reopened: int

class CategoryDistribution(BaseModel):
    name: str
    count: int
    percentage: float

class WorkloadItem(BaseModel):
    user_id: int
    developer_name: str
    avatar_url: Optional[str] = None
    assigned_count: int
    critical_count: int
    overdue_count: int
    workload_status: str  # "OPTIMAL", "HEAVY", "OVERLOADED"

class ManagerDashboardResponse(BaseModel):
    total_bugs: int
    open_bugs: int
    in_development_bugs: int
    resolved_bugs: int
    critical_bugs: int
    avg_resolution_days: float
    sla_compliance_rate: float
    trend_history: List[TimeSeriesPoint]
    severity_breakdown: Dict[str, int]
    priority_breakdown: Dict[str, int]
    status_breakdown: Dict[str, int]
    component_breakdown: List[CategoryDistribution]
    team_workload: List[WorkloadItem]

class DeveloperDashboardResponse(BaseModel):
    my_assigned_bugs_count: int
    my_in_progress_count: int
    my_in_review_count: int
    my_overdue_count: int
    my_resolved_this_week: int
    my_avg_resolution_days: float
    my_active_prs_count: int
    my_severity_breakdown: Dict[str, int]
    my_priority_breakdown: Dict[str, int]
    my_bugs_list: List[Dict[str, Any]]

class QADashboardResponse(BaseModel):
    waiting_for_verification_count: int
    ready_for_testing_count: int
    regression_bugs_count: int
    reopened_bugs_count: int
    total_verified_this_week: int
    verification_turnaround_hours: float
    reopen_rate_percentage: float
    reopened_reasons_breakdown: Dict[str, int]
    test_verification_queue: List[Dict[str, Any]]
