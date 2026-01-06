export interface User {
  id?: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  address: string;
  activated?: boolean;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  address: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface AuthError {
  message: string;
  errors?: Record<string, string[]>;
}
