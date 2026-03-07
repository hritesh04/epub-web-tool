import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
if (!API_BASE_URL && import.meta.env.PROD) {
  console.error('VITE_API_BASE_URL is not defined in production!')
}

const api = axios.create({
  baseURL: API_BASE_URL || 'http://localhost:3000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000
})

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Optional: Add response interceptors for global error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.get('/refresh');
        isRefreshing = false;
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        
        // Clear auth state and redirect
        window.dispatchEvent(new Event('auth-unauthorized'));
        
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api
