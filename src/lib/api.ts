import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_BMS_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

try {
  const storedToken = localStorage.getItem('token');
  if (storedToken) {
    api.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
  }
} catch {
  // ignore localStorage access errors
}

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      if (!config.headers || typeof config.headers !== 'object') {
        config.headers = {} as typeof config.headers;
      }
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore localStorage access errors
    console.error('[API Interceptor] Error:', e);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      try {
        localStorage.removeItem('welinc_user');
        localStorage.removeItem('token');
      } catch {
        // ignore localStorage access errors
      }

      // A protected request can be the first indication that a session has
      // expired while the user is navigating. Send them to Sign In rather
      // than leaving the current page with a generic loading error.
      if (window.location.pathname !== '/login') {
        window.location.assign('/login?sessionExpired=1');
      }
    }
    return Promise.reject(error);
  },
);
