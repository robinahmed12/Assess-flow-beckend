import { z } from "zod";

export const createInvitationSchema = z.object({
  body: z.object({
    candidateEmail: z
      .string()
      .email("Invalid candidate email")
      .transform((email) => email.toLowerCase()),

    expiresAt: z
      .string()
      .datetime()
      .optional(),
  }),

  params: z.object({
    id: z.string().uuid("Invalid assessment ID"),
  }),

  query: z.object({}),
});

export const assessmentInvitationIdSchema = z.object({
  body: z.object({}),

  params: z.object({
    id: z.string().uuid("Invalid assessment ID"),
  }),

  query: z.object({}),
});

export const invitationTokenSchema = z.object({
  body: z.object({}),

  params: z.object({
    token: z.string().min(32, "Invalid invitation token"),
  }),

  query: z.object({}),
});