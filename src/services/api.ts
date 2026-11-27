import {
  CandidateProfile,
  DashboardSummary,
  JobMatch,
  ModelMetricsResponse,
  SalaryPredictionResult,
  SkillCatalogItem,
  SkillGapResult,
  SkillRecommendation,
  User,
} from '../types';

// Keep auth token strictly in React/JS memory (never localStorage/sessionStorage)
let memoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  memoryToken = token;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

export function formatINR(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export function formatLPA(amount: number): string {
  const lpa = amount / 100000;
  return `₹${lpa.toFixed(1)} LPA`;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (memoryToken) {
    headers['Authorization'] = `Bearer ${memoryToken}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export const api = {
  getModelMetrics: () => apiRequest<ModelMetricsResponse>('/api/model/metrics'),

  getSkillsCatalog: () =>
    apiRequest<{ skills: SkillCatalogItem[] }>('/api/skills/catalog'),

  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) =>
    apiRequest<{ token: string; user: User; profile: CandidateProfile }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  login: (payload: { email: string; password: string }) =>
    apiRequest<{ token: string; user: User; profile: CandidateProfile }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  logout: () =>
    apiRequest<{ message: string }>('/api/auth/logout', { method: 'POST' }),

  forgotPassword: (email: string) =>
    apiRequest<{ message: string; demoResetCode?: string; expiresAt?: string }>(
      '/api/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    ),

  resetPassword: (payload: {
    email: string;
    resetCode: string;
    newPassword: string;
    confirmPassword: string;
  }) =>
    apiRequest<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getDashboardSummary: () =>
    apiRequest<DashboardSummary>('/api/dashboard/summary'),

  getProfile: () =>
    apiRequest<{ user: User; profile: CandidateProfile }>('/api/profile'),

  updateProfile: (payload: Partial<CandidateProfile> & { fullName?: string }) =>
    apiRequest<{ message: string; user: User; profile: CandidateProfile }>(
      '/api/profile',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),

  predictSalary: (payload: {
    jobRole?: string;
    city?: string;
    educationLevel?: string;
    experienceYears?: number;
    employmentStatus?: string;
    skills?: string[];
  }) =>
    apiRequest<SalaryPredictionResult>('/api/salary/predict', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSalaryHistory: () =>
    apiRequest<{ history: SalaryPredictionResult[] }>('/api/salary/history'),

  analyzeSkillGap: (payload: { targetRole?: string; skills?: string[] }) =>
    apiRequest<SkillGapResult>('/api/skills/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSkillRecommendations: () =>
    apiRequest<{ recommendations: SkillRecommendation[] }>(
      '/api/skills/recommendations'
    ),

  refreshSkillRecommendations: (payload: {
    targetRole?: string;
    skills?: string[];
  }) =>
    apiRequest<{ targetRole: string; recommendations: SkillRecommendation[] }>(
      '/api/skills/recommend',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  getRecommendedJobs: (filters: Record<string, string> = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const qs = params.toString();
    return apiRequest<{
      isDemonstrationData: boolean;
      notice: string;
      recommendations: JobMatch[];
    }>(`/api/jobs/recommended${qs ? `?${qs}` : ''}`);
  },

  getSavedJobs: () =>
    apiRequest<{ savedJobs: JobMatch[] }>('/api/jobs/saved'),

  toggleSaveJob: (jobId: string) =>
    apiRequest<{ saved: boolean; jobId: string; message: string }>(
      `/api/jobs/${encodeURIComponent(jobId)}/save`,
      { method: 'POST' }
    ),
};
