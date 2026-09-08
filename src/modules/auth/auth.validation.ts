import { UserRole } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100),

    email: z
      .string()
      .email("Invalid email address")
      .transform((email) => email.toLowerCase()),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100),

    role: z.nativeEnum(UserRole).optional(),
  }),

  params: z.object({}),

  query: z.object({}),
});

export const verifyRegistrationOtpSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Invalid email address")
      .transform((email) => email.toLowerCase()),

    otp: z
      .string()
      .regex(/^\d{6}$/, "OTP must be a 6 digit number"),
  }),

  params: z.object({}),

  query: z.object({}),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Invalid email address")
      .transform((email) => email.toLowerCase()),

    password: z.string().min(1, "Password is required"),
  }),

  params: z.object({}),

  query: z.object({}),
});

export const googleLoginSchema = z.object({
  body: z.object({
    credential: z
      .string()
      .min(1, "Google credential is required"),
  }),

  params: z.object({}),

  query: z.object({}),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Invalid email address")
      .transform((email) => email.toLowerCase()),
  }),

  params: z.object({}),

  query: z.object({}),
});

export const verifyForgotPasswordOtpSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Invalid email address")
      .transform((email) => email.toLowerCase()),

    otp: z
      .string()
      .regex(/^\d{6}$/, "OTP must be a 6 digit number"),
  }),

  params: z.object({}),

  query: z.object({}),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    resetToken: z
      .string()
      .min(1, "Reset token is required"),

    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100),
  }),

  params: z.object({}),

  query: z.object({}),
});