export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  createdAt: string;
  lastLogin?: string;
  roles: UserRole[];
}

export interface UserRole {
  buildingId: number;
  buildingName: string;
  role: 'super_admin' | 'house_owner' | 'house_manager' | 'house_viewer';
  grantedAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}
