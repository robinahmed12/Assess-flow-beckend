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
