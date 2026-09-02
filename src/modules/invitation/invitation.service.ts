import {
  AssessmentStatus,
  InvitationStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../app/common/errors/app-error";

interface CreateInvitationInput {
  candidateEmail: string;
  expiresAt?: Date | string;
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

    if (data.expiresAt) {
      const expiresAt = new Date(data.expiresAt);

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

    return prisma.invitation.create({
      data: {
        assessmentId,
        candidateId: candidate.id,

        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
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
}
