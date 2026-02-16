/**
 * Request/response types for auth flows.
 */

export interface SignupBody {
  phoneNumber: string;
  email?: string;
  fullName?: string;
}

export interface SendOtpBody {
  phoneNumber: string;
}

export interface VerifyOtpBody {
  phoneNumber: string;
  otp: string;
}

export interface LoginBody {
  phoneNumber: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface CustomerPayload {
  id: string;
  phoneNumber: string;
}

export interface AuthSuccessResponse {
  message: string;
  requiresOtpVerification?: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}
