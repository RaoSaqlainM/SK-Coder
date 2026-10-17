export interface AuthUser {
  username: string;
  role: "admin";
}

export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

export interface JWTPayload {
  username: string;
  role: "admin";
  iat: number;
  exp: number;
}
