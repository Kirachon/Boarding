import { writable } from 'svelte/store';
import { goto } from '$app/navigation';
import { apiClient } from '$utils/api';
import type { User, AuthState } from '$types/auth';

// Initial auth state
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null
};

// Create the auth store
function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,
    
    // Initialize auth from localStorage
    initialize: () => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_token');
        const userStr = localStorage.getItem('auth_user');
        
        if (token && userStr) {
          try {
            const user = JSON.parse(userStr);
            set({
              isAuthenticated: true,
              user,
              token,
              loading: false,
              error: null
            });
            
            // Set token in API client
            apiClient.setAuthToken(token);
          } catch (error) {
            console.error('Failed to parse stored user data:', error);
            authStore.logout();
          }
        }
      }
    },
    
    // Login action
    login: async (email: string, password: string) => {
      update(state => ({ ...state, loading: true, error: null }));
      
      try {
        const response = await apiClient.post('/auth/login', { email, password });
        const { user, token } = response.data;
        
        // Store in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_user', JSON.stringify(user));
        }
        
        // Set token in API client
        apiClient.setAuthToken(token);
        
        // Update store
        set({
          isAuthenticated: true,
          user,
          token,
          loading: false,
          error: null
        });
        
        // Redirect to dashboard
        goto('/dashboard');
        
        return { success: true };
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Login failed';
        
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage
        }));
        
        return { success: false, error: errorMessage };
      }
    },
    
    // Register action
    register: async (userData: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    }) => {
      update(state => ({ ...state, loading: true, error: null }));
      
      try {
        const response = await apiClient.post('/auth/register', userData);
        const { user, token } = response.data;
        
        // Store in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_user', JSON.stringify(user));
        }
        
        // Set token in API client
        apiClient.setAuthToken(token);
        
        // Update store
        set({
          isAuthenticated: true,
          user,
          token,
          loading: false,
          error: null
        });
        
        // Redirect to dashboard
        goto('/dashboard');
        
        return { success: true };
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Registration failed';
        
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage
        }));
        
        return { success: false, error: errorMessage };
      }
    },
    
    // Logout action
    logout: async () => {
      update(state => ({ ...state, loading: true }));
      
      try {
        // Call logout endpoint to blacklist token
        await apiClient.post('/auth/logout');
      } catch (error) {
        console.error('Logout API call failed:', error);
      }
      
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
      
      // Clear API client token
      apiClient.clearAuthToken();
      
      // Reset store
      set(initialState);
      
      // Redirect to login
      goto('/auth/login');
    },
    
    // Update user profile
    updateProfile: async (profileData: Partial<User>) => {
      update(state => ({ ...state, loading: true, error: null }));
      
      try {
        const response = await apiClient.put('/auth/profile', profileData);
        const { user } = response.data;
        
        // Update localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_user', JSON.stringify(user));
        }
        
        // Update store
        update(state => ({
          ...state,
          user,
          loading: false,
          error: null
        }));
        
        return { success: true };
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Profile update failed';
        
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage
        }));
        
        return { success: false, error: errorMessage };
      }
    },
    
    // Change password
    changePassword: async (currentPassword: string, newPassword: string) => {
      update(state => ({ ...state, loading: true, error: null }));
      
      try {
        await apiClient.put('/auth/password', {
          currentPassword,
          newPassword
        });
        
        update(state => ({
          ...state,
          loading: false,
          error: null
        }));
        
        return { success: true };
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Password change failed';
        
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage
        }));
        
        return { success: false, error: errorMessage };
      }
    },
    
    // Clear error
    clearError: () => {
      update(state => ({ ...state, error: null }));
    },
    
    // Check if user has specific role
    hasRole: (role: string, buildingId?: number): boolean => {
      let currentState: AuthState;
      subscribe(state => currentState = state)();
      
      if (!currentState.user?.roles) return false;
      
      return currentState.user.roles.some(userRole => {
        if (userRole.role === 'super_admin') return true;
        if (buildingId && userRole.buildingId !== buildingId) return false;
        return userRole.role === role;
      });
    },
    
    // Get accessible buildings
    getAccessibleBuildings: (): number[] => {
      let currentState: AuthState;
      subscribe(state => currentState = state)();
      
      if (!currentState.user?.roles) return [];
      
      return currentState.user.roles.map(role => role.buildingId);
    }
  };
}

export const authStore = createAuthStore();
