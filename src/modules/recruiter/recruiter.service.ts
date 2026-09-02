import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../app/common/errors/app-error";
import { generateSlug } from "../../app/common/utils/generate-slug";
import { generateAccessToken } from "../../app/common/utils/jwt";


interface RegisterRecruiterInput {
  name: string;
  email: string;
  password: string;
  companyName: string;
}

export class RecruiterService {
  static async register(data: RegisterRecruiterInput) {
    const existingUser = await prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (existingUser) {
      throw new AppError("Email is already registered", 409);
    }

    const baseSlug = generateSlug(data.companyName);

    let slug = baseSlug;
    let counter = 1;

    while (
      await prisma.company.findUnique({
        where: { slug },
      })
    ) {
      counter += 1;
      slug = `${baseSlug}-${counter}`;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          role: UserRole.RECRUITER,
          status: UserStatus.ACTIVE,
        },
      });

      const company = await tx.company.create({
        data: {
          name: data.companyName,
          slug,
          ownerId: user.id,
        },
      });

      return {
        user,
        company,
      };
    });

    const accessToken = generateAccessToken({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },

      company: {
        id: result.company.id,
        name: result.company.name,
        slug: result.company.slug,
        credits: result.company.credits,
      },

      accessToken,
    };
  }
}