import crypto from "crypto";
import ejs from "ejs";
import path from "path";
import { prisma } from "../../lib/prisma";
import { AssessmentStatus, UserRole, UserStatus } from "@prisma/client";
import { AppError } from "../../app/common/errors/app-error";
import { transporter } from "../../lib/nodemailer";
import config from "../../app/config";

interface CreateInvitationInput {
  candidateEmail: string;
  expiresAt?: string;
}

export class InvitationService {
  private static readonly DEFAULT_INVITATION_VALID_DAYS = 7;

  private static async getRecruiterCompany(userId: string) {
    const company = await prisma.company.findUnique({
      where: {
        ownerId: userId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!company) {
      throw new AppError("Company not found for this recruiter", 404);
    }

    return company;
  }

  private static resolveExpiresAt(expiresAt?: string) {
    if (expiresAt) {
      const deadline = new Date(expiresAt);

      if (Number.isNaN(deadline.getTime())) {
        throw new AppError("Invalid invitation expiration date", 400);
      }

      if (deadline <= new Date()) {
        throw new AppError("Invitation expiration must be in the future", 400);
      }

      return deadline;
    }

    const defaultDeadline = new Date();
    defaultDeadline.setDate(
      defaultDeadline.getDate() + this.DEFAULT_INVITATION_VALID_DAYS
    );

    return defaultDeadline;
  }

  private static buildInvitationLink(token: string) {
    return `${config.frontend_url}/invitations/accept?token=${token}`;
  }

  private static async sendInvitationEmail(params: {
    candidateEmail: string;
    candidateName: string | null;
    assessmentTitle: string;
    duration: number | null;
    expiresAt: Date;
    token: string;
    companyName: string;
  }) {
    const invitationLink = this.buildInvitationLink(params.token);

    const templatePath = path.join(
      process.cwd(),
      "template",
      "invitation-email.ejs"
    );

    const emailHtml = await ejs.renderFile(templatePath, {
      candidateName: params.candidateName,
      assessmentTitle: params.assessmentTitle,
      duration: params.duration,
      deadline: params.expiresAt.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      invitationLink,
      companyName: params.companyName,
    });

    await transporter.sendMail({
      from: config.smtp_user,
      to: params.candidateEmail,
      subject: `Assessment invitation: ${params.assessmentTitle}`,
      html: emailHtml,
    });
  }

  static async create(
    recruiterId: string,
    assessmentId: string,
    data: CreateInvitationInput
  ) {
    const company = await this.getRecruiterCompany(recruiterId);

    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        companyId: company.id,
      },
      select: {
        id: true,
        title: true,
        duration: true,
        status: true,
        companyId: true,
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

    const expiresAt = this.resolveExpiresAt(data.expiresAt);

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
        409
      );
    }

    const token = crypto.randomBytes(32).toString("hex");

    const invitation = await prisma.invitation.create({
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

    await this.sendInvitationEmail({
      candidateEmail: candidate.email,
      candidateName: candidate.name,
      assessmentTitle: assessment.title,
      duration: assessment.duration,
      expiresAt,
      token,
      companyName: company.name,
    });

    return {
      ...invitation,
      invitationLink: this.buildInvitationLink(token),
    };
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

  static async verifyInvitationToken(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: {
        token,
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        assessment: {
          select: {
            id: true,
            title: true,
            duration: true,
            status: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new AppError("Invalid invitation link", 404);
    }

    if (invitation.expiresAt && invitation.expiresAt <= new Date()) {
      throw new AppError("Invitation link has expired", 410);
    }

    if (invitation.assessment.status !== AssessmentStatus.PUBLISHED) {
      throw new AppError("Assessment is no longer available", 400);
    }

    if (invitation.candidate.status !== UserStatus.ACTIVE) {
      throw new AppError("Candidate account is not active", 400);
    }

    return invitation;
  }
}