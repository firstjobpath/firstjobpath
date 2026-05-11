import { prisma } from "../lib/prisma.js";

const XP_PER_LEVEL = 500;

export async function awardXp(userId: string, delta: number) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      xp: { increment: delta },
      lastActiveAt: new Date(),
    },
  });
  const level = Math.floor(user.xp / XP_PER_LEVEL) + 1;
  if (level > user.level) {
    await prisma.user.update({
      where: { id: userId },
      data: { level },
    });
  }
  return { xp: user.xp, level: Math.max(level, user.level) };
}

export async function recordStreak(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const last = user.lastActiveAt;
  const now = new Date();
  let streak = user.streakDays;
  if (!last) streak = 1;
  else {
    const diffDays = Math.floor((now.getTime() - last.getTime()) / 86400000);
    if (diffDays === 0) return;
    if (diffDays === 1) streak += 1;
    else streak = 1;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { streakDays: streak, lastActiveAt: now },
  });
}
