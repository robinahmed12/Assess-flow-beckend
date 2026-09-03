import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { AssessmentStatus, UserRole, UserStatus } from "@prisma/client";
import { AppError } from "../../app/common/errors/app-error";

interface CreateInvitationInput {
  candidateEmail: string;
  expiresAt?: string;
}

export class InvitationService {
  private static async getRecruiterCompany(userId: string) {
    const company = await prisma.company.findUnique({
      where: {
        ownerId: userId,
      },
      select: {
        id: true,
      },
    });

    if (!company) {
      throw new AppError("Company not found for this recruiter", 404);
    }

    return company;
  }

  static async create(
    recruiterId: string,
    assessmentId: string,
    data: CreateInvitationInput,
  ) {
    const company = await this.getRecruiterCompany(recruiterId);

    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        companyId: company.id,
      },
    });

    if (!assessment) {
      throw new AppError("Assessment not found", 404);
    }

    if (assessment.status !== AssessmentStatus.PUBLISHED) {
      throw new AppError("Only published assessments can be assigned", 400);
    }

    const candidate = await prisma.user.findUnique({
      where: {
        email: data.candidateEmail,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!candidate) {
      throw new AppError("Candidate not found", 404);
    }

    if (candidate.role !== UserRole.CANDIDATE) {
      throw new AppError("Selected user is not a candidate", 400);
    }

    if (candidate.status !== UserStatus.ACTIVE) {
      throw new AppError("Candidate account is not active", 400);
    }

    let expiresAt: Date | null = null;

    if (data.expiresAt) {
      expiresAt = new Date(data.expiresAt);

      if (Number.isNaN(expiresAt.getTime())) {
        throw new AppError("Invalid invitation expiration date", 400);
      }

      if (expiresAt <= new Date()) {
        throw new AppError("Invitation expiration must be in the future", 400);
      }
    }

    const existingInvitation = await prisma.invitation.findUnique({
      where: {
        assessmentId_candidateId: {
          assessmentId,
          candidateId: candidate.id,
        },
      },
    });

    if (existingInvitation) {
      throw new AppError(
        "Candidate has already been invited to this assessment",
        409,
      );
    }

    const token = crypto.randomBytes(32).toString("hex");

    return prisma.invitation.create({
      data: {
        token,
        candidateEmail: candidate.email,
        assessmentId,
        candidateId: candidate.id,
        expiresAt,
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assessment: {
          select: {
            id: true,
            title: true,
            duration: true,
          },
        },
      },
    });
  }

  static async findByAssessment(recruiterId: string, assessmentId: string) {
    const company = await this.getRecruiterCompany(recruiterId);

    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        companyId: company.id,
      },
    });

    if (!assessment) {
      throw new AppError("Assessment not found", 404);
    }

    return prisma.invitation.findMany({
      where: {
        assessmentId,
      },

      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        attempt: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            expiresAt: true,
            submittedAt: true,
            score: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
