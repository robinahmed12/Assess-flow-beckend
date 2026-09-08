import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { CreateAuditLogInput } from "./audit.types";

type PrismaTx = Prisma.TransactionClient;

export class AuditService {
  static async create(
    tx: PrismaTx,
    data: CreateAuditLogInput
  ) {
    return tx.auditLog.create({
      data: {
        actorId: data.actorId ?? null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  static async createWithoutTransaction(data: CreateAuditLogInput) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId ?? null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata ?? undefined,
      },
    });
  }
}