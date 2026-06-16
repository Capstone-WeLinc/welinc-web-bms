import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000',
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