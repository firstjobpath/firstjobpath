import { createHash, randomBytes } from "crypto";
import type { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";

function hashRefresh(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function issueAuthTokens(userId: string, role: Role, userAgent?: string | null) {
  const accessToken = signToken(userId, role);
  const rawRefresh = randomBytes(48).toString("hex");
  const tokenHash = hashRefresh(rawRefresh);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: userAgent ?? null,
    },
  });

  return { accessToken, refreshToken: rawRefresh };
}

export async function rotateRefreshToken(rawRefresh: string, userAgent?: string | null) {
  const tokenHash = hashRefresh(rawRefresh);
  const row = await prisma.refreshToken.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
  });
  if (!row) throw Object.assign(new Error("Invalid refresh token"), { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user) throw Object.assign(new Error("User not found"), { status: 401 });

  await prisma.refreshToken.delete({ where: { id: row.id } });

  return issueAuthTokens(user.id, user.role, userAgent);
}
