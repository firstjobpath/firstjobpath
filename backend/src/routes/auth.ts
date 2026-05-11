import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { issueAuthTokens, rotateRefreshToken } from "../services/auth-tokens.service.js";
import { verifyGoogleIdToken, findOrCreateGoogleUser } from "../services/google-auth.service.js";
import { verifyOtp, requestOtp } from "../services/otp.service.js";
import { enqueueNotification } from "../services/notification.service.js";
import { auditLog } from "../services/audit.service.js";
import { recordStreak } from "../services/gamification.service.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  otp: z.string().length(6).optional(),
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const { name, email, password, phone, otp } = parsed.data;

    if (process.env.REQUIRE_REGISTER_OTP === "true") {
      if (!otp) {
        res.status(400).json({ error: "OTP required for registration" });
        return;
      }
      const v = await verifyOtp({
        destination: email,
        channel: "EMAIL",
        purpose: "REGISTER",
        code: otp,
      });
      if (!v.ok) {
        res.status(400).json({ error: v.reason });
        return;
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hash,
        phone: phone ?? null,
        role: "STUDENT",
        emailVerified: process.env.REQUIRE_REGISTER_OTP === "true",
      },
    });

    const tokens = await issueAuthTokens(user.id, user.role, req.get("user-agent"));
    await enqueueNotification({
      userId: user.id,
      channel: "EMAIL",
      templateKey: "welcome",
      payload: { to: user.email, name: user.name },
    });
    await auditLog({ userId: user.id, action: "auth.register", resource: "user", resourceId: user.id });

    res.status(201).json({
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  }),
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    const ok = user?.password ? await bcrypt.compare(password, user.password) : false;

    await prisma.loginAttempt.create({
      data: {
        email,
        ip: req.ip ?? null,
        success: ok,
      },
    });

    if (!user?.password || !ok) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const tokens = await issueAuthTokens(user.id, user.role, req.get("user-agent"));
    await recordStreak(user.id);
    await auditLog({ userId: user.id, action: "auth.login", resource: "user", resourceId: user.id });

    res.json({
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  }),
);

authRouter.post(
  "/google",
  asyncHandler(async (req, res) => {
    const schema = z.object({ idToken: z.string().min(10) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "idToken required" });
      return;
    }
    const g = await verifyGoogleIdToken(parsed.data.idToken);
    const user = await findOrCreateGoogleUser({
      googleId: g.googleId,
      email: g.email,
      name: g.name,
    });
    const tokens = await issueAuthTokens(user.id, user.role, req.get("user-agent"));
    await recordStreak(user.id);
    res.json({
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const schema = z.object({ refreshToken: z.string().min(10) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "refreshToken required" });
      return;
    }
    const tokens = await rotateRefreshToken(parsed.data.refreshToken, req.get("user-agent"));
    res.json({
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  }),
);

authRouter.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (user) {
      await requestOtp({
        destination: parsed.data.email,
        channel: "EMAIL",
        purpose: "RESET_PASSWORD",
      });
    }
    res.json({ ok: true });
  }),
);

authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      otp: z.string().length(6),
      newPassword: z.string().min(8),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const v = await verifyOtp({
      destination: parsed.data.email,
      channel: "EMAIL",
      purpose: "RESET_PASSWORD",
      code: parsed.data.otp,
    });
    if (!v.ok) {
      res.status(400).json({ error: v.reason });
      return;
    }
    const hash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { email: parsed.data.email },
      data: { password: hash },
    });
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        xp: true,
        level: true,
        streakDays: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  }),
);

