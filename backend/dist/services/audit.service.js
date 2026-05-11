import { prisma } from "../lib/prisma.js";
export async function auditLog(input) {
    await prisma.auditLog.create({
        data: {
            userId: input.userId ?? undefined,
            action: input.action,
            resource: input.resource,
            resourceId: input.resourceId ?? undefined,
            ip: input.ip ?? undefined,
            userAgent: input.userAgent ?? undefined,
            metadata: (input.metadata ?? undefined),
        },
    });
}
