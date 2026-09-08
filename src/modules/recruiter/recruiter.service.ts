import bcrypt from "bcryptjs";
import ejs from "ejs";
import path from "path";
import { UserRole, UserStatus } from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { AppError } from "../../app/common/errors/app-error";
import { generateSlug } from "../../app/common/utils/generate-slug";
import { generateAccessToken } from "../../app/common/utils/jwt";
import { redisClient, connectRedis } from "../../lib/redisClinet";
import { transporter } from "../../lib/nodemailer";
import { uploadBufferToCloudinary } from "../../app/common/utils/upload-to-cloudinary";
import config from "../../app/config";

import {
  PendingRecruiterRegistration,
  RegisterRecruiterInput,
  VerifyRecruiterOtpInput,
} from "./recruiter.types";

const RECRUITER_OTP_EXPIRE_SECONDS = 5 * 60;

export class RecruiterService {
  private static getRecruiterOtpKey(email: string) {
    return `recruiter:registration:otp:${email}`;
  }

  private static generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static async register(
    data: RegisterRecruiterInput,
    files: {
      companyLicensePaper?: Express.Multer.File[];
      selfDocument?: Express.Multer.File[];
    },
  ) {
    const existingUser = await prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (existingUser) {
      throw new AppError("Email is already registered", 409);
    }

    const companyLicensePaper = files?.companyLicensePaper?.[0];
    const selfDocument = files?.selfDocument?.[0];

    if (!companyLicensePaper) {
      throw new AppError("Company license paper PDF is required", 400);
    }

    if (!selfDocument) {
      throw new AppError("Self document PDF is required", 400);
    }

    await connectRedis();

    const otp = this.generateOtp();
    const passwordHash = await bcrypt.hash(data.password, 12);

    const companyLicenseUpload = await uploadBufferToCloudinary(
      companyLicensePaper,
      "recruiter/company-license-papers",
    );

    const selfDocumentUpload = await uploadBufferToCloudinary(
      selfDocument,
      "recruiter/self-documents",
    );

    const pendingRegistration: PendingRecruiterRegistration = {
      name: data.name,
      email: data.email,
      passwordHash,
      companyName: data.companyName,
      companyLicensePaperUrl: companyLicenseUpload.secure_url,
      companyLicensePaperPublicId: companyLicenseUpload.public_id,
      selfDocumentUrl: selfDocumentUpload.secure_url,
      selfDocumentPublicId: selfDocumentUpload.public_id,
      otp,
    };

    const redisKey = this.getRecruiterOtpKey(data.email);

    await redisClient.set(redisKey, JSON.stringify(pendingRegistration), {
      EX: RECRUITER_OTP_EXPIRE_SECONDS,
    });

    const templatePath = path.join(
      process.cwd(),
      "src",
      "app",
      "template",
      "verify-email.ejs",
    );

    const emailHtml = await ejs.renderFile(templatePath, {
      name: data.name,
      email: data.email,
      otp,
      expiresInMinutes: 5,
    });

    await transporter.sendMail({
      from: config.smtp_user,
      to: data.email,
      subject: "Verify your recruiter account",
      html: emailHtml,
    });

    return {
      email: data.email,
      message:
        "OTP sent successfully. Please verify your email to complete recruiter registration.",
      expiresInSeconds: RECRUITER_OTP_EXPIRE_SECONDS,
    };
  }

  static async verifyOtp(data: VerifyRecruiterOtpInput) {
    await connectRedis();

    const redisKey = this.getRecruiterOtpKey(data.email);

    const pendingRegistrationJson = await redisClient.get(redisKey);

    if (!pendingRegistrationJson) {
      throw new AppError("OTP expired or registration request not found", 400);
    }

    const pendingRegistration = JSON.parse(
      pendingRegistrationJson,
    ) as PendingRecruiterRegistration;

    if (pendingRegistration.otp !== data.otp) {
      throw new AppError("Invalid OTP", 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: pendingRegistration.email,
      },
    });

    if (existingUser) {
      await redisClient.del(redisKey);
      throw new AppError("Email is already registered", 409);
    }

    const baseSlug = generateSlug(pendingRegistration.companyName);

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

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: pendingRegistration.name,
          email: pendingRegistration.email,
          passwordHash: pendingRegistration.passwordHash,
          role: UserRole.RECRUITER,
          status: UserStatus.ACTIVE,
        },
      });

      const company = await tx.company.create({
        data: {
          name: pendingRegistration.companyName,
          slug,
          ownerId: user.id,

          // Make sure these fields exist in your Prisma Company model.
          companyLicensePaperUrl: pendingRegistration.companyLicensePaperUrl,
          companyLicensePaperPublicId:
            pendingRegistration.companyLicensePaperPublicId,
          selfDocumentUrl: pendingRegistration.selfDocumentUrl,
          selfDocumentPublicId: pendingRegistration.selfDocumentPublicId,
        },
      });

      return {
        user,
        company,
      };
    });

    await redisClient.del(redisKey);

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
        companyLicensePaperUrl: result.company.companyLicensePaperUrl,
        selfDocumentUrl: result.company.selfDocumentUrl,
      },

      accessToken,
    };
  }
}
