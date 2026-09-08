import { UserRole } from "@prisma/client";

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface VerifyRegistrationOtpInput {
  email: string;
  otp: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
export interface GoogleLoginInput {
  credential: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface VerifyForgotPasswordOtpInput {
  email: string;
  otp: string;
}

export interface ResetPasswordInput {
  resetToken: string;
  newPassword: string;
}
