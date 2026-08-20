import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Hydrate Authorization header on initialization if token exists in localStorage
try {
  const initialToken = localStorage.getItem("aidss_token");
  if (initialToken) {
    api.defaults.headers.common.Authorization = `Bearer ${initialToken}`;
  }
} catch {
  // Ignore in SSR / restricted storage environments
}

/** Sets (or clears) the Authorization header used on every subsequent request. */
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

/** Sets CSRF token header for state-changing requests */
export function setCsrfToken(csrf) {
  if (csrf) {
    api.defaults.headers.common["X-CSRF-Token"] = csrf;
  } else {
    delete api.defaults.headers.common["X-CSRF-Token"];
  }
}

let unauthorizedHandler = null;
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

// Request interceptor to ensure Authorization header is always present if token exists
api.interceptors.request.use(
  (config) => {
    if (!config.headers.Authorization) {
      try {
        const token = localStorage.getItem("aidss_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // Ignore
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

export function describeError(error, fallback = "An unexpected error occurred.") {
  if (!error?.response) {
    return `Can't reach the server at ${API_BASE_URL}. Is the backend running?`;
  }
  const detail = error.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
  }
  return fallback;
}

// Authentication & MFA
export const googleLogin = async (payload) => (await api.post("/api/auth/google", payload)).data;
export const githubLogin = async (payload) => (await api.post("/api/auth/github", payload)).data;
export const setupMFA = async () => (await api.post("/api/auth/mfa/setup")).data;
export const enableMFA = async (payload) => (await api.post("/api/auth/mfa/enable", payload)).data;
export const verifyMFALogin = async (payload) => (await api.post("/api/auth/mfa/verify-login", payload)).data;
export const regenerateRecoveryCodes = async () => (await api.post("/api/auth/mfa/recovery-codes/regenerate")).data;
export const disableMFA = async (payload) => (await api.post("/api/auth/mfa/disable", payload)).data;
export const changeAuthPassword = async (payload) => (await api.post("/api/auth/change-password", payload)).data;
export const logoutAuth = async () => (await api.post("/api/auth/logout")).data;
export const getSecurityAuditLogs = async (limit = 25) => (await api.get("/api/auth/audit-logs", { params: { limit } })).data;

// System
export const getHealth = async () => (await api.get("/api/health")).data;
export const triggerSeed = async () => (await api.post("/api/seed")).data;

// Users & Profile
export const getUsers = async () => (await api.get("/api/users")).data;
export const getMyProfile = async () => (await api.get("/api/users/me")).data;
export const updateMyProfile = async (payload) => (await api.put("/api/users/me", payload)).data;
export const changePassword = async (payload) => (await api.post("/api/auth/change-password", payload)).data;
export const createUser = async (payload) => (await api.post("/api/users", payload)).data;

// Projects
export const getProjects = async (params) => (await api.get("/api/projects", { params })).data;
export const getProject = async (id) => (await api.get(`/api/projects/${id}`)).data;
export const createProject = async (payload) => (await api.post("/api/projects", payload)).data;
export const updateProject = async (id, payload) => (await api.put(`/api/projects/${id}`, payload)).data;
export const deleteProject = async (id) => (await api.delete(`/api/projects/${id}`)).data;
export const getProjectSnapshots = async (id, days = 30) => (await api.get(`/api/projects/${id}/snapshots`, { params: { days } })).data;

// Sprints
export const getSprints = async (params) => (await api.get("/api/sprints", { params })).data;
export const getSprint = async (id) => (await api.get(`/api/sprints/${id}`)).data;
export const createSprint = async (payload) => (await api.post("/api/sprints", payload)).data;
export const updateSprint = async (id, payload) => (await api.put(`/api/sprints/${id}`, payload)).data;
export const startSprint = async (id) => (await api.post(`/api/sprints/${id}/start`)).data;
export const completeSprint = async (id) => (await api.post(`/api/sprints/${id}/complete`)).data;
export const deleteSprint = async (id) => (await api.delete(`/api/sprints/${id}`)).data;
export const getSprintBurndown = async (id) => (await api.get(`/api/sprints/${id}/burndown`)).data;

// Tasks
export const getTasks = async (params) => (await api.get("/api/tasks", { params })).data;
export const getTask = async (id) => (await api.get(`/api/tasks/${id}`)).data;
export const createTask = async (payload) => (await api.post("/api/tasks", payload)).data;
export const updateTask = async (id, payload) => (await api.put(`/api/tasks/${id}`, payload)).data;
export const updateTaskStatus = async (id, status, position) =>
  (await api.patch(`/api/tasks/${id}/status`, { status, position })).data;
export const deleteTask = async (id) => (await api.delete(`/api/tasks/${id}`)).data;

// Team
export const getTeamMembers = async (params) => (await api.get("/api/team", { params })).data;
export const addTeamMember = async (payload) => (await api.post("/api/team", payload)).data;
export const removeTeamMember = async (id) => (await api.delete(`/api/team/${id}`)).data;
export const getTeamWorkload = async (params) => (await api.get("/api/team/workload", { params })).data;

// AI Decision Engine
export const getAIOverview = async () => (await api.get("/api/ai/overview")).data;
export const getProjectHealth = async (id) => (await api.get(`/api/ai/projects/${id}/health`)).data;
export const getSprintHealth = async (id) => (await api.get(`/api/ai/sprints/${id}/health`)).data;
export const getProjectForecast = async (id) => (await api.get(`/api/ai/projects/${id}/forecast`)).data;
export const syncAIProject = async (id) => (await api.post(`/api/ai/sync/${id}`)).data;
export const analyzeAllAI = async (projectId) => (await api.post("/api/ai/analyze", { project_id: projectId })).data;

// Recommendations
export const getRecommendations = async (params) => (await api.get("/api/recommendations", { params })).data;
export const createRecommendation = async (payload) => (await api.post("/api/recommendations", payload)).data;
export const updateRecommendationStatus = async (id, status) =>
  (await api.patch(`/api/recommendations/${id}/status`, { status })).data;
export const applyRecommendation = async (id) => (await api.post(`/api/recommendations/${id}/apply`)).data;

// Risks
export const getRisks = async (params) => (await api.get("/api/risks", { params })).data;
export const createRisk = async (payload) => (await api.post("/api/risks", payload)).data;
export const updateRiskStatus = async (id, status) =>
  (await api.patch(`/api/risks/${id}/status?status=${status}`)).data;
export const deleteRisk = async (id) => (await api.delete(`/api/risks/${id}`)).data;

// Reports
export const getReportsSummary = async (params) => (await api.get("/api/reports/summary", { params })).data;
export const getReportCSVDownloadUrl = (projectId) =>
  `${API_BASE_URL}/api/reports/export/csv${projectId && projectId !== "All" ? `?project_id=${projectId}` : ""}`;

// Activity Log & Timeline
export const getActivity = async (params) => (await api.get("/api/activity", { params })).data;

// Daily Standup Check-ins
export const getCheckIns = async (params) => (await api.get("/api/checkins", { params })).data;
export const submitCheckIn = async (payload) => (await api.post("/api/checkins", payload)).data;

// User Notifications
export const getNotifications = async (params) => (await api.get("/api/notifications", { params })).data;
export const markNotificationRead = async (id) => (await api.patch(`/api/notifications/${id}/read`)).data;
export const markAllNotificationsRead = async () => (await api.post("/api/notifications/read-all")).data;

// Global Search
export const globalSearch = async (q) => (await api.get("/api/search", { params: { q } })).data;

export default api;
