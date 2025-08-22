import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { goto } from '$app/navigation';

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Create axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    // Handle common error scenarios
    if (error.response) {
      const { status, data } = error.response;
      
      // Handle authentication errors
      if (status === 401) {
        // Clear auth data and redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          goto('/auth/login');
        }
      }
      
      // Handle server errors
      if (status >= 500) {
        console.error('Server error:', data);
      }
      
      // Enhance error message
      error.message = data?.message || data?.error || error.message;
    } else if (error.request) {
      // Network error
      error.message = 'Network error. Please check your connection.';
    }
    
    return Promise.reject(error);
  }
);

// API client class
class ApiClient {
  private instance: AxiosInstance;
  
  constructor(instance: AxiosInstance) {
    this.instance = instance;
  }
  
  // Set authentication token
  setAuthToken(token: string) {
    this.instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
  
  // Clear authentication token
  clearAuthToken() {
    delete this.instance.defaults.headers.common['Authorization'];
  }
  
  // Generic request method
  async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.request<T>(config);
  }
  
  // GET request
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.get<T>(url, config);
  }
  
  // POST request
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.post<T>(url, data, config);
  }
  
  // PUT request
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.put<T>(url, data, config);
  }
  
  // PATCH request
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.patch<T>(url, data, config);
  }
  
  // DELETE request
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.delete<T>(url, config);
  }
  
  // Upload file
  async uploadFile<T = any>(url: string, file: File, onProgress?: (progress: number) => void): Promise<AxiosResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.instance.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  }
  
  // Download file
  async downloadFile(url: string, filename?: string): Promise<void> {
    const response = await this.instance.get(url, {
      responseType: 'blob',
    });
    
    // Create download link
    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }
}

// Create and export API client instance
export const apiClient = new ApiClient(axiosInstance);

// Export types for use in components
export type { AxiosResponse, AxiosRequestConfig };

// API endpoints constants
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    PROFILE: '/auth/profile',
    CHANGE_PASSWORD: '/auth/password',
  },
  
  // Buildings
  BUILDINGS: {
    LIST: '/buildings',
    CREATE: '/buildings',
    GET: (id: number) => `/buildings/${id}`,
    UPDATE: (id: number) => `/buildings/${id}`,
    DELETE: (id: number) => `/buildings/${id}`,
  },
  
  // Rooms
  ROOMS: {
    LIST: '/rooms',
    CREATE: '/rooms',
    GET: (id: number) => `/rooms/${id}`,
    UPDATE: (id: number) => `/rooms/${id}`,
    DELETE: (id: number) => `/rooms/${id}`,
    AVAILABILITY: (id: number) => `/rooms/${id}/availability`,
  },
  
  // Tenants
  TENANTS: {
    LIST: '/tenants',
    CREATE: '/tenants',
    GET: (id: number) => `/tenants/${id}`,
    UPDATE: (id: number) => `/tenants/${id}`,
    DELETE: (id: number) => `/tenants/${id}`,
  },
  
  // Bookings
  BOOKINGS: {
    LIST: '/bookings',
    CREATE: '/bookings',
    GET: (id: number) => `/bookings/${id}`,
    UPDATE: (id: number) => `/bookings/${id}`,
    DELETE: (id: number) => `/bookings/${id}`,
  },
  
  // Expenses
  EXPENSES: {
    LIST: '/expenses',
    CREATE: '/expenses',
    GET: (id: number) => `/expenses/${id}`,
    UPDATE: (id: number) => `/expenses/${id}`,
    DELETE: (id: number) => `/expenses/${id}`,
  },
  
  // Inventory
  INVENTORY: {
    LIST: '/inventory',
    CREATE: '/inventory',
    GET: (id: number) => `/inventory/${id}`,
    UPDATE: (id: number) => `/inventory/${id}`,
    DELETE: (id: number) => `/inventory/${id}`,
  },
  
  // Health
  HEALTH: {
    STATUS: '/health',
    DETAILED: '/health/detailed',
    REALTIME: '/health/realtime',
  },
} as const;
