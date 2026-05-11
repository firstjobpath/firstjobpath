import { Prisma, type NotificationChannel } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function enqueueNotification(input: {
  userId?: string;
  channel: NotificationChannel;
  templateKey: string;
  payload: Record<string, unknown>;
  scheduledFor?: Date;
}) {
  await prisma.notificationJob.create({
    data: {
      userId: input.userId,
      channel: input.channel,
      templateKey: input.templateKey,
      payload: input.payload as Prisma.InputJsonValue,
      scheduledFor: input.scheduledFor ?? new Date(),
    },
  });
}
