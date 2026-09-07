import { z } from "zod";

export const registerRecruiterSchema = z.object({
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

    companyName: z
      .string()
      .min(2, "Company name must be at least 2 characters")
      .max(150),
  }),

  params: z.object({}),
  query: z.object({}),
});

export const verifyRecruiterOtpSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Invalid email address")
      .transform((email) => email.toLowerCase()),

    otp: z
      .string()
      .length(6, "OTP must be 6 digits")
      .regex(/^\d+$/, "OTP must contain only numbers"),
  }),

  params: z.object({}),
  query: z.object({}),
});