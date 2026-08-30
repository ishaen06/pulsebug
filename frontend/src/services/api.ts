import {
  User, Project, Bug, Comment, Attachment, GitIntegration, Notification,
  AITriageResponse, AIDuplicateCheckResponse, AIQualityScoreResponse,
  AIReproductionStepsResponse, AIAssigneeRecommendResponse, AIPrioritizeResponse,
  AINLSearchResponse, ProjectHealthResponse, ManagerDashboardResponse, BugRelation,
  ForgotPasswordResponse, VerifyResetTokenResponse, ResetPasswordResponse
} from '../types';

const API_BASE = (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api/v1` : '/api/v1');

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('pulsebug_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'An error occurred';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (data: { email: string; password: string; full_name: string; role: string; skills?: string[] }) =>
    request<{ message: string; email: string; is_verified: boolean; requires_verification: boolean; verification_code?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  verifyEmail: (email: string, code: string) =>
    request<{ success: boolean; message: string; token?: { access_token: string; token_type: string; user: User } }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  resendVerification: (email: string) =>
    request<{ success: boolean; message: string; verification_code?: string }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  getMe: () => request<User>('/auth/me'),
  getUsers: () => request<User[]>('/auth/users'),
  switchDemoUser: (email: string) =>
    request<{ access_token: string; user: User }>(`/auth/switch-demo-user/${encodeURIComponent(email)}`, {
      method: 'POST',
    }),

  // Projects
  getProjects: () => request<Project[]>('/projects'),
  getProject: (id: number) => request<Project>(`/projects/${id}`),

  // Bugs
  getBugs: (params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    });
    const queryStr = searchParams.toString();
    return request<Bug[]>(`/bugs${queryStr ? `?${queryStr}` : ''}`);
  },
  getBug: (id: number) => request<Bug>(`/bugs/${id}`),
  createBug: (data: Partial<Bug>) =>
    request<Bug>('/bugs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateBug: (id: number, data: Partial<Bug> & { reason?: string }) =>
    request<Bug>(`/bugs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  addBugRelation: (bugId: number, targetBugId: number, relationType: string) =>
    request<BugRelation>(`/bugs/${bugId}/relations`, {
      method: 'POST',
      body: JSON.stringify({ target_bug_id: targetBugId, relation_type: relationType }),
    }),
  deleteBugRelation: (bugId: number, relationId: number) =>
    request<{ success: boolean }>(`/bugs/${bugId}/relations/${relationId}`, {
      method: 'DELETE',
    }),

  // Comments
  getComments: (bugId: number) => request<Comment[]>(`/bugs/${bugId}/comments`),
  addComment: (bugId: number, content: string, parentId?: number) =>
    request<Comment>(`/bugs/${bugId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parent_id: parentId }),
    }),
  updateComment: (commentId: number, data: { content?: string; is_resolved?: boolean }) =>
    request<Comment>(`/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Git Integration
  simulateGitEvent: (bugId: number, eventType: string, prNumber?: number) =>
    request<any>(`/git/simulate/${bugId}`, {
      method: 'POST',
      body: JSON.stringify({ event_type: eventType, pr_number: prNumber }),
    }),
  getGitIntegrations: (bugId: number) => request<GitIntegration[]>(`/git/bug/${bugId}`),

  // AI Engines
  aiTriage: (title: string, description: string, steps?: string, projectId?: number) =>
    request<AITriageResponse>('/ai/triage', {
      method: 'POST',
      body: JSON.stringify({ title, description, steps_to_reproduce: steps, project_id: projectId }),
    }),
  aiDuplicateCheck: (title: string, description: string, projectId?: number, excludeBugId?: number) =>
    request<AIDuplicateCheckResponse>('/ai/duplicate-check', {
      method: 'POST',
      body: JSON.stringify({ title, description, project_id: projectId, exclude_bug_id: excludeBugId }),
    }),
  aiQualityScore: (data: {
    title: string;
    description: string;
    steps_to_reproduce?: string;
    expected_behavior?: string;
    actual_behavior?: string;
    technical_context?: any;
  }) =>
    request<AIQualityScoreResponse>('/ai/quality-score', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  aiReproductionSteps: (messyDescription: string) =>
    request<AIReproductionStepsResponse>('/ai/reproduction-steps', {
      method: 'POST',
      body: JSON.stringify({ messy_description: messyDescription }),
    }),
  aiRecommendAssignee: (data: {
    component: string;
    category: string;
    severity: string;
    title: string;
    description: string;
    project_id?: number;
  }) =>
    request<AIAssigneeRecommendResponse>('/ai/recommend-assignee', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  aiPrioritize: (data: {
    severity: string;
    affected_users_estimate?: string;
    is_production?: boolean;
    is_security_impact?: boolean;
    is_financial_or_data_loss?: boolean;
    is_regression?: boolean;
    frequency?: string;
  }) =>
    request<AIPrioritizeResponse>('/ai/prioritize', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  aiNLSearch: (query: string) =>
    request<AINLSearchResponse>('/ai/nl-search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  // Analytics
  getProjectHealth: (projectId: number) =>
    request<ProjectHealthResponse>(`/analytics/project/${projectId}/health`),
  getManagerAnalytics: (projectId?: number) =>
    request<ManagerDashboardResponse>(`/analytics/manager${projectId ? `?project_id=${projectId}` : ''}`),
  getDeveloperAnalytics: () => request<any>('/analytics/developer'),
  getQAAnalytics: (projectId?: number) =>
    request<any>(`/analytics/qa${projectId ? `?project_id=${projectId}` : ''}`),

  // Notifications
  getNotifications: () => request<Notification[]>('/notifications'),
  markNotificationRead: (id: number) =>
    request<Notification>(`/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_read: true }),
    }),
  markAllNotificationsRead: () =>
    request<{ success: boolean }>('/notifications/mark-all-read', {
      method: 'POST',
    }),

  // Password Reset
  forgotPassword: (email: string) =>
    request<ForgotPasswordResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verifyResetToken: (token: string) =>
    request<VerifyResetTokenResponse>('/auth/verify-reset-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<ResetPasswordResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    }),
};

