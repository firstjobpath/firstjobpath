import { prisma } from "../lib/prisma.js";
export async function enqueueNotification(input) {
    await prisma.notificationJob.create({
        data: {
            userId: input.userId,
            channel: input.channel,
            templateKey: input.templateKey,
            payload: input.payload,
            scheduledFor: input.scheduledFor ?? new Date(),
        },
    });
}
