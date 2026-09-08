import bcrypt from "bcryptjs";
import crypto from "crypto";
import ejs from "ejs";
import path from "path";

import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { generateAccessToken } from "../../app/common/utils/jwt";
import { AppError } from "../../app/common/errors/app-error";
import {
  LoginInput,
  RegisterInput,
  VerifyRegistrationOtpInput,
} from "./auth.types";
import { connectRedis, redisClient, } from "../../lib/redisClinet";
import { transporter } from "../../lib/nodemailer";
import config from "../../app/config";

const REGISTRATION_OTP_TTL_SECONDS = 5 * 60;
const REGISTRATION_OTP_EXPIRY_MINUTES = REGISTRATION_OTP_TTL_SECONDS / 60;

interface PendingRegistrationData {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  otp: string;
}

const getRegistrationOtpKey = (email: string) => `registration:otp:${email}`;

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const sendVerificationOtpEmail = async ({
  email,
  name,
  otp,
}: {
  email: string;
  name: string;
  otp: string;
}) => {
  const templatePath = path.join(
    process.cwd(),
    "src",
    "app",
    "template",
    "verify-email.ejs"
  );

  const html = await ejs.renderFile(templatePath, {
    name,
    email,
    otp,
    expiresInMinutes: REGISTRATION_OTP_EXPIRY_MINUTES,
  });

  await transporter.sendMail({
    from: config.smtp_user,
    to: email,
    subject: "Verify your email address",
    html,
  });
};

export class AuthService {
  static async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (existingUser) {
      throw new AppError("Email is already registered", 409);
    }

    const otp = generateOtp();
    const passwordHash = await bcrypt.hash(data.password, 12);
    const pendingRegistrationData: PendingRegistrationData = {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role || UserRole.CANDIDATE,
      otp,
    };

    await connectRedis();

    await redisClient.set(
      getRegistrationOtpKey(data.email),
      JSON.stringify(pendingRegistrationData),
      {
        EX: REGISTRATION_OTP_TTL_SECONDS,
      }
    );

    await sendVerificationOtpEmail({
      email: data.email,
      name: data.name,
      otp,
    });

    return {
      email: data.email,
      expiresInMinutes: REGISTRATION_OTP_EXPIRY_MINUTES,
    };
  }

  static async verifyRegistrationOtp(data: VerifyRegistrationOtpInput) {
    await connectRedis();

    const redisKey = getRegistrationOtpKey(data.email);
    const pendingRegistration = await redisClient.get(redisKey);

    if (!pendingRegistration) {
      throw new AppError("OTP expired or registration request not found", 400);
    }

    const pendingRegistrationData = JSON.parse(
      pendingRegistration
    ) as PendingRegistrationData;

    if (pendingRegistrationData.otp !== data.otp) {
      throw new AppError("Invalid OTP", 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (existingUser) {
      await redisClient.del(redisKey);
      throw new AppError("Email is already registered", 409);
    }

    const user = await prisma.user.create({
      data: {
        name: pendingRegistrationData.name,
        email: pendingRegistrationData.email,
        passwordHash: pendingRegistrationData.passwordHash,
        role: pendingRegistrationData.role,
        status: UserStatus.ACTIVE,
      },
    });

    await redisClient.del(redisKey);

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
    };
  }

  static async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppError("Your account is not active", 403);
    }

    const isPasswordValid = await bcrypt.compare(
      data.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
    };
  }

  static async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  }
}
