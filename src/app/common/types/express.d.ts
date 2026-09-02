import { UserRole, UserStatus } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        status: UserStatus;
      };
    }
  }
}

export {};