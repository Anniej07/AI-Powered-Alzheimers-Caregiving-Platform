import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const authAPI = {
  login:           (data)          => api.post('/auth/login', data),
  register:        (data)          => api.post('/auth/register', data),
  getMe:           ()              => api.get('/auth/me'),
  updateProfile:   (data)          => api.put('/auth/profile', data),
  changePassword:  (data)          => api.put('/auth/change-password', data),
  forgotPassword:  (data)          => api.post('/auth/forgot-password', data),
  resetPassword:   (token, data)   => api.post(`/auth/reset-password/${token}`, data),
  logout:          ()              => api.post('/auth/logout'),
};

// ── Users ─────────────────────────────────────────────────────
export const usersAPI = {
  getMyPatients:       ()         => api.get('/users/patients'),
  getPatient:          (id)       => api.get(`/users/patients/${id}`),
  assignPatient:       (data)     => api.post('/users/assign-patient', data),
  removePatient:       (id)       => api.delete(`/users/assign-patient/${id}`),
  getProviders:        (role)     => api.get('/users/providers', { params: { role } }),
  updatePatientMedical:(id, data) => api.put(`/users/patients/${id}/medical`, data),
};

// ── Medications ───────────────────────────────────────────────
export const medsAPI = {
  getAll:         (patientId, params) => api.get(`/medications/patient/${patientId}`, { params }),
  add:            (data)              => api.post('/medications', data),
  update:         (id, data)          => api.put(`/medications/${id}`, data),
  remove:         (id)                => api.delete(`/medications/${id}`),
  logDose:        (id, data)          => api.post(`/medications/${id}/dose-log`, data),
  getSchedule:    (patientId)         => api.get(`/medications/schedule/${patientId}`),
  getAdherence:   (patientId, days)   => api.get(`/medications/adherence/${patientId}`, { params: { days } }),
};

// ── Prescriptions ─────────────────────────────────────────────
export const rxAPI = {
  getAll:  (patientId) => api.get(`/prescriptions/patient/${patientId}`),
  getOne:  (id)        => api.get(`/prescriptions/${id}`),
  create:  (data)      => api.post('/prescriptions', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update:  (id, data)  => api.put(`/prescriptions/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove:  (id)        => api.delete(`/prescriptions/${id}`),
  share:   (id, data)  => api.post(`/prescriptions/${id}/share`, data),
};

// ── Emotions ──────────────────────────────────────────────────
export const emotionAPI = {
  submit:      (data)            => api.post('/emotions', data),
  getHistory:  (patientId, p)    => api.get(`/emotions/patient/${patientId}`, { params: p }),
  getAnalytics:(patientId, days) => api.get(`/emotions/analytics/${patientId}`, { params: { days } }),
  getLatest:   (patientId)       => api.get(`/emotions/latest/${patientId}`),
};

// ── Alerts ────────────────────────────────────────────────────
export const alertsAPI = {
  getAll:      (params) => api.get('/alerts', { params }),
  getCount:    ()       => api.get('/alerts/count'),
  create:      (data)   => api.post('/alerts', data),
  acknowledge: (id)     => api.put(`/alerts/${id}/acknowledge`),
  resolve:     (id, d)  => api.put(`/alerts/${id}/resolve`, d),
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardAPI = {
  getMe:       () => api.get('/dashboard/me'),
  getPatient:  (id) => api.get(`/dashboard/patient/${id}`),
  getCaregiver:() => api.get('/dashboard/caregiver'),
  getDoctor:   () => api.get('/dashboard/doctor'),
  getFamily:   () => api.get('/dashboard/family'),
};
export default api;
