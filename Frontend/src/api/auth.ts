import api from "./config";
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  VerifyEmailRequest,
  RefreshTokenRequest,
  ApiResponse,
  User,
  UserSession,
} from "../types";
export const authApi = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    return (await api.post("/auth/login", data)).data;
  },
  async register(data: RegisterRequest): Promise<AuthResponse> {
    return (await api.post("/auth/register", data)).data;
  },
  async logout(): Promise<ApiResponse> {
    return (await api.post("/auth/logout", {})).data;
  },
  async logoutAll(): Promise<ApiResponse> {
    return (await api.post("/auth/logout-all", {})).data;
  },
  async refreshToken(data?: RefreshTokenRequest): Promise<AuthResponse> {
    return (await api.post("/auth/refresh-token", data || {})).data;
  },
  async verifyEmail(
    data: VerifyEmailRequest,
  ): Promise<ApiResponse<{ user: User }>> {
    return (await api.post("/auth/verify-email", data)).data;
  },
  async resendVerificationEmail(): Promise<ApiResponse> {
    return (await api.post("/auth/resend-verification", {})).data;
  },
  async forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse> {
    return (await api.post("/auth/forgot-password", data)).data;
  },
  async resetPassword(data: ResetPasswordRequest): Promise<ApiResponse> {
    return (await api.post("/auth/reset-password", data)).data;
  },
  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse> {
    return (await api.post("/auth/change-password", data)).data;
  },
  async getProfile(): Promise<
    ApiResponse<{ user: User; activeDevices: number }>
  > {
    return (await api.get("/auth/profile")).data;
  },
  async updateProfile(
    data: UpdateProfileRequest,
  ): Promise<ApiResponse<{ user: User }>> {
    return (await api.put("/auth/profile", data)).data;
  },
  async getActiveSessions(): Promise<ApiResponse<UserSession>> {
    return (await api.get("/users/me/sessions")).data;
  },
  async revokeSession(id: string): Promise<ApiResponse> {
    return (await api.delete(`/users/me/sessions/${id}`)).data;
  },
};
