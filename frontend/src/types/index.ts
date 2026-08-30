export type UserRole = 'DEVELOPER' | 'TESTER';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  skills: string[];
  active_status: string;
  is_verified?: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  key: string;
  name: string;
  description?: string;
  lead_id?: number;
  components: string[];
  environments: string[];
  created_at: string;
  updated_at: string;
  bug_count: number;
  open_bug_count: number;
  critical_bug_count: number;
}

export type BugSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type BugPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type BugStatus = 
  | 'REPORTED'
  | 'NEW'
  | 'AI_TRIAGE'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_DEVELOPMENT'
  | 'CODE_REVIEW'
  | 'READY_FOR_TESTING'
  | 'TESTING'
  | 'RESOLVED'
  | 'VERIFIED'
  | 'CLOSED'
  | 'REOPENED';

export interface TechnicalContext {
  browser?: string;
  os?: string;
  screen_resolution?: string;
  device?: string;
  app_version?: string;
  user_agent?: string;
}

export interface BugRelation {
  id: number;
  source_bug_id: number;
  target_bug_id: number;
  relation_type: 'BLOCKS' | 'BLOCKED_BY' | 'RELATED_TO' | 'DUPLICATE_OF' | 'PARENT_OF' | 'CHILD_OF' | 'REGRESSION_OF';
  target_bug_key?: string;
  target_bug_title?: string;
  target_bug_status?: string;
  created_at: string;
}

export interface GitIntegration {
  id: number;
  branch_name?: string;
  commit_sha?: string;
  commit_message?: string;
  pr_number?: number;
  pr_title?: string;
  pr_status?: 'OPEN' | 'REVIEW_REQUESTED' | 'APPROVED' | 'MERGED' | 'CLOSED';
  release_tag?: string;
  author?: string;
  url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  bug_id: number;
  user_id?: number;
  user_name: string;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  reason?: string;
  timestamp: string;
}

export interface Comment {
  id: number;
  bug_id: number;
  author_id: number;
  parent_id?: number;
  content: string;
  is_resolved: boolean;
  edit_history?: Array<{ previous_content: string; edited_at: string; edited_by: string }>;
  created_at: string;
  updated_at: string;
  author?: User;
  replies?: Comment[];
}

export interface Attachment {
  id: number;
  bug_id: number;
  file_name: string;
  file_size: number;
  content_type: string;
  uploaded_at: string;
}

export interface Bug {
  id: number;
  bug_key: string;
  project_id: number;
  title: string;
  description: string;
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  category: string;
  component: string;
  severity: BugSeverity;
  priority: BugPriority;
  impact_score: number;
  status: BugStatus;
  environment: string;
  reporter_id: number;
  assignee_id?: number;
  labels: string[];
  is_security_sensitive: boolean;
  is_stale: boolean;
  sla_due_date?: string;
  sla_breached: boolean;
  technical_context: TechnicalContext;
  quality_score: number;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
  reporter?: User;
  assignee?: User;
  comments_count?: number;
  attachments_count?: number;
  git_links_count?: number;
  sla_hours_remaining?: number;
  sla_percentage?: number;
  age_days?: number;
  comments?: Comment[];
  relations?: BugRelation[];
  git_integrations?: GitIntegration[];
  audit_logs?: AuditLog[];
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  bug_id?: number;
  bug_key?: string;
  is_read: boolean;
  created_at: string;
}

// AI Schemas
export interface AITriageResponse {
  category: string;
  component: string;
  severity: BugSeverity;
  priority: BugPriority;
  suggested_labels: string[];
  suggested_assignee?: string;
  suggested_assignee_id?: number;
  confidence_score: number;
  reasoning: string;
}

export interface DuplicateCandidate {
  bug_id: number;
  bug_key: string;
  title: string;
  similarity_score: number;
  status: string;
  severity: string;
  component: string;
  match_reason: string;
  is_resolved: boolean;
  resolved_in_version?: string;
}

export interface AIDuplicateCheckResponse {
  has_duplicates: boolean;
  highest_similarity: number;
  duplicates: DuplicateCandidate[];
  is_possible_regression: boolean;
  regression_reference_bug?: DuplicateCandidate;
}

export interface QualityCheckItem {
  item: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  description: string;
  points: number;
}

export interface AIQualityScoreResponse {
  score: number;
  grade: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
  checklist: QualityCheckItem[];
  missing_elements: string[];
  improvement_suggestions: string[];
}

export interface AIReproductionStepsResponse {
  structured_steps: string[];
  expected_behavior: string;
  actual_behavior: string;
  cleaned_description: string;
  summary_title?: string;
}

export interface AssigneeMatch {
  user_id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  match_score: number;
  active_bugs_count: number;
  critical_bugs_count: number;
  skills_match: string[];
  rationale: string;
}

export interface AIAssigneeRecommendResponse {
  recommended_assignees: AssigneeMatch[];
  top_recommendation?: AssigneeMatch;
  reasoning: string;
}

export interface AIPrioritizeResponse {
  impact_score: number;
  recommended_priority: BugPriority;
  urgency_level: string;
  calculation_breakdown: Record<string, number>;
  explanation: string;
}

export interface AINLSearchResponse {
  original_query: string;
  interpreted_intent: string;
  ai_agent_summary?: string;
  parsed_filters: Record<string, any>;
  active_filter_chips: string[];
  suggested_followups?: string[];
  confidence_score?: number;
  extracted_keywords?: string[];
}

// Analytics Schemas
export interface HealthFactor {
  factor_name: string;
  impact_weight: number;
  status: 'GOOD' | 'WARNING' | 'CRITICAL';
  score_contribution: number;
  diagnostic_message: string;
}

export interface ProjectHealthResponse {
  project_id: number;
  project_name: string;
  project_key: string;
  overall_health_score: number;
  health_grade: string;
  critical_open_bugs: number;
  overdue_sla_bugs: number;
  regression_rate: number;
  avg_resolution_time_days: number;
  stale_bugs_count: number;
  total_open_bugs: number;
  total_resolved_bugs: number;
  resolution_velocity_per_week: number;
  health_factors: HealthFactor[];
  root_cause_warnings: string[];
}

export interface TimeSeriesPoint {
  date: string;
  opened: number;
  resolved: number;
  reopened: number;
}

export interface CategoryDistribution {
  name: string;
  count: number;
  percentage: number;
}

export interface WorkloadItem {
  user_id: number;
  developer_name: string;
  avatar_url?: string;
  assigned_count: number;
  critical_count: number;
  overdue_count: number;
  workload_status: 'OPTIMAL' | 'HEAVY' | 'OVERLOADED';
}

export interface ManagerDashboardResponse {
  total_bugs: number;
  open_bugs: number;
  in_development_bugs: number;
  resolved_bugs: number;
  critical_bugs: number;
  avg_resolution_days: number;
  sla_compliance_rate: number;
  trend_history: TimeSeriesPoint[];
  severity_breakdown: Record<string, number>;
  priority_breakdown: Record<string, number>;
  status_breakdown: Record<string, number>;
  component_breakdown: CategoryDistribution[];
  team_workload: WorkloadItem[];
}

// Password Reset Types
export interface ForgotPasswordResponse {
  message: string;
  simulated_reset_link?: string;
  expires_in_minutes: number;
}

export interface VerifyResetTokenResponse {
  valid: boolean;
  status: 'VALID' | 'EXPIRED' | 'USED' | 'INVALID';
  email?: string;
  message: string;
}

// Email Verification Types
export interface RegisterResponse {
  message: string;
  email: string;
  is_verified: boolean;
  requires_verification: boolean;
  verification_code?: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
  token?: {
    access_token: string;
    token_type: string;
    user: User;
  };
}

export interface ResendVerificationResponse {
  success: boolean;
  message: string;
  verification_code?: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

