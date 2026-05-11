import { prisma } from "../lib/prisma.js";
import { sendTemplatedEmail } from "../services/email.service.js";

let interval: ReturnType<typeof setInterval> | null = null;

export function startNotificationWorker() {
  if (interval) return;
  interval = setInterval(() => {
    void processBatch();
  }, 5000);
}

async function processBatch() {
  const eligible = await prisma.notificationJob.findMany({
    where: {
      OR: [{ status: "PENDING" }, { status: "FAILED", attempts: { lt: 5 } }],
      scheduledFor: { lte: new Date() },
    },
    take: 25,
    orderBy: { createdAt: "asc" },
  });

  for (const job of eligible) {
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING" },
    });
    try {
      if (job.channel === "EMAIL") {
        await sendTemplatedEmail(job.templateKey, job.payload as Record<string, unknown>);
      } else if (job.channel === "SMS" || job.channel === "WHATSAPP") {
        console.info(`[notify:${job.channel}]`, job.templateKey, job.payload);
      } else {
        console.info(`[notify:${job.channel}] stub`, job.templateKey);
      }
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });
    } catch (e) {
      const attempts = job.attempts + 1;
      const fail = attempts >= job.maxAttempts;
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: fail ? "FAILED" : "PENDING",
          attempts,
          lastError: String(e),
          scheduledFor: fail ? job.scheduledFor : new Date(Date.now() + attempts * 60_000),
        },
      });
    }
  }
}
