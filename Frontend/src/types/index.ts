
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'ADMIN';
  provider: 'LOCAL' | 'GOOGLE';
  isEmailVerified: boolean;
  isActive: boolean;
  avatar?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface GoogleAuthRequest {
  googleToken: string;
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
    isNewUser?: boolean;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
    value?: unknown;
  }>;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface Session {
  id: string;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
}

export interface UserSession {
  sessions: Session[];
}

export interface GoogleAuthStatus {
  isLinked: boolean;
  provider: string;
  hasPassword: boolean;
  canUnlink: boolean;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

export interface PaginatedUsers {
  users: User[];
  pagination: Pagination;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'USER' | 'ADMIN';
  provider?: 'LOCAL' | 'GOOGLE';
  verified?: boolean;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: 'USER' | 'ADMIN';
  isActive?: boolean;
}

export interface UpdateRolePayload {
  userId: string;
  role: 'USER' | 'ADMIN';
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  verifiedUsers: number;
  recentUsers: number;
  breakdown: Array<{
    role: string;
    provider: string;
    isEmailVerified: boolean;
    isActive: boolean;
    _count: number;
  }>;
}

export interface AdminState {
  users: User[];
  currentUser: User | null;
  stats: UserStats | null;
  pagination: Pagination;
  filters: UserFilters;
  isLoading: boolean;
  error: string | null;
}
