import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function auditLog(input: {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? undefined,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? undefined,
      ip: input.ip ?? undefined,
      userAgent: input.userAgent ?? undefined,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
