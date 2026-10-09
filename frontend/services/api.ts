import axios, { AxiosError } from 'axios';
import type { ValidHospitalRegistration } from '@shared/hospitalRegistration';

// Use a same-origin proxy so the browser can reliably send the backend auth cookie.
const API_BASE = '/backend-api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  // Fail fast when the backend is down instead of hanging indefinitely
  timeout: 10000,
});

let sessionBridgePromise: Promise<boolean> | null = null;
const retriedRequests = new WeakSet<object>();
const sessionRetryMarker = 'X-Session-Bridge-Retried';

api.interceptors.request.use((request) => {
  if (request.headers.get(sessionRetryMarker) === '1') {
    request.headers.delete(sessionRetryMarker);
    retriedRequests.add(request);
  }
  return request;
});

function refreshBackendSession(): Promise<boolean> {
  if (!sessionBridgePromise) {
    sessionBridgePromise = fetch('/api/auth/session-bridge', {
      method: 'POST',
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch((error: unknown) => {
        console.error('Could not refresh the backend session:', error);
        return false;
      })
      .finally(() => {
        sessionBridgePromise = null;
      });
  }
  return sessionBridgePromise;
}

/**
 * Returns true when the error is a network-level failure (backend down /
 * ECONNREFUSED / no response at all) rather than an HTTP error response.
 */
export function isServerUnavailable(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const e = err as AxiosError;
  // No response means the TCP connection never succeeded
  return !e.response && (e.code === 'ECONNREFUSED' || e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED' || !e.code);
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : fallback;
  }

  if (!err.response) {
    return 'The backend API is not responding. Confirm the backend is running, then retry.';
  }

  const responseMessage = (err.response.data as { message?: unknown } | undefined)?.message;
  return typeof responseMessage === 'string' ? responseMessage : fallback;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const request = error.config;
    const isPublicAuthRequest = request?.url
      ? /^\/(auth\/(login|register|forgot-password|reset-password)|staff\/login)(?:\/|$)/.test(request.url)
      : false;

    if (
      error.response?.status === 401 &&
      request &&
      !retriedRequests.has(request) &&
      !isPublicAuthRequest
    ) {
      request.headers.set(sessionRetryMarker, '1');
      if (await refreshBackendSession()) {
        return api.request(request);
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: Record<string, unknown>) => api.post('/auth/register', data),
  login: (data: Record<string, unknown>) => api.post('/auth/login', data),
  staffLogin: (data: Record<string, unknown>) => api.post('/staff/login', data),
  logout: () => api.post('/auth/logout'),
  staffLogout: () => api.post('/staff/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: Record<string, unknown>) => api.post('/auth/reset-password', data),
  changePassword: (data: Record<string, unknown>) => api.post('/auth/change-password', data),
  getHospitalPublic: () => api.get('/hospital'),
};

// Appointments
export const appointmentApi = {
  getMyAppointments: (params?: Record<string, unknown>) => api.get('/appointments/my', { params }),
  getAll: (params?: Record<string, unknown>) => api.get('/appointments', { params }),
  getById: (id: string) => api.get(`/appointments/${id}`),
  create: (data: Record<string, unknown>) => api.post('/appointments', data),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/appointments/${id}/status`, { status, notes }),
};

// Queue
export const queueApi = {
  getQueue: (params?: Record<string, unknown>) => api.get('/queue', { params }),
  getMyPosition: () => api.get('/queue/my'),
  updateEntry: (id: string, data: Record<string, unknown>) => api.patch(`/queue/${id}`, data),
};

// Hospital/data
export const hospitalApi = {
  getHospitals: () => api.get('/hospitals'),
  getManageSettings: () => api.get('/hospital/manage'),
  updateSettings: (data: Record<string, unknown>) => api.patch('/hospital', data),
  createDepartment: (data: { name: string; description: string }) => api.post('/departments', data),
  getDepartments: (hospitalId?: string) =>
    api.get('/departments', { params: hospitalId ? { hospitalId } : {} }),
  getDoctors: (params?: Record<string, unknown>) => api.get('/doctors', { params }),
  getDoctorById: (id: string) => api.get(`/doctors/${id}`),
};

export const hospitalRegistrationApi = {
  register: (data: ValidHospitalRegistration) => api.post('/hospitals/register', data),
  verifyEmail: (data: { email: string; code: string }) => api.post('/hospitals/verify-email', data),
  resendCode: (email: string) => api.post('/hospitals/resend-code', { email }),
};

// AI
export const aiApi = {
  assess: (data: Record<string, unknown>) => api.post('/ai/priority-assessment', data),
  reviewAssessment: (id: string, data: Record<string, unknown>) =>
    api.patch(`/ai/priority-assessment/${id}/review`, data),
};

// Admin
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getTrends: () => api.get('/admin/trends'),
  getPriorityDistribution: () => api.get('/admin/priority-distribution'),
  getDepartmentPerformance: () => api.get('/admin/department-performance'),
  getUsers: (params?: Record<string, unknown>) => api.get('/admin/users', { params }),
  // Team management
  getTeam: (params?: Record<string, unknown>) => api.get('/team', { params }),
  addTeamMember: (data: Record<string, unknown>) => api.post('/team', data),
  inviteAdmin: (data: Record<string, unknown>) => api.post('/team/admins', data),
  updateTeamMember: (id: string, data: Record<string, unknown>) => api.patch(`/team/${id}`, data),
  removeTeamMember: (id: string, data?: Record<string, unknown>) => api.post(`/team/${id}/remove`, data),
  reactivateTeamMember: (id: string) => api.post(`/team/${id}/reactivate`),
  getAuditLog: (params?: Record<string, unknown>) => api.get('/admin/audit-log', { params }),
};

// Notifications
export const notificationApi = {
  getAll: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/all/read'),
};

// Health check — used by ServerBanner to detect backend availability
export const healthApi = {
  check: () =>
    axios.get(`${API_BASE}/health`, { timeout: 4000 }),
};

export default api;
