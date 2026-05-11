import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { adminAnalyticsSummary } from "../services/analytics.service.js";
import { prisma } from "../lib/prisma.js";
import { refundPaymentStructure } from "../services/payment.service.js";
import { enqueueNotification } from "../services/notification.service.js";
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole(["ADMIN"]));
adminRouter.get("/analytics/summary", asyncHandler(async (_req, res) => {
    const summary = await adminAnalyticsSummary();
    res.json(summary);
}));
adminRouter.get("/transactions", asyncHandler(async (req, res) => {
    const take = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await prisma.payment.findMany({
        take,
        orderBy: { createdAt: "desc" },
        include: {
            user: { select: { name: true, email: true } },
            transactions: true,
        },
    });
    res.json({ transactions: rows });
}));
adminRouter.get("/notifications/jobs", asyncHandler(async (req, res) => {
    const take = Math.min(Number(req.query.limit) || 100, 500);
    const rows = await prisma.notificationJob.findMany({
        take,
        orderBy: { createdAt: "desc" },
    });
    res.json({ jobs: rows });
}));
adminRouter.post("/broadcast", asyncHandler(async (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title : "Announcement";
    const body = typeof req.body?.body === "string" ? req.body.body : "";
    const students = await prisma.user.findMany({
        where: { role: "STUDENT" },
        select: { id: true, email: true },
        take: 500,
    });
    for (const s of students) {
        await enqueueNotification({
            userId: s.id,
            channel: "EMAIL",
            templateKey: "placement_notification",
            payload: { to: s.email, title, body },
        });
    }
    res.json({ queued: students.length });
}));
adminRouter.post("/payments/:id/refund", asyncHandler(async (req, res) => {
    const out = await refundPaymentStructure(String(req.params.id), req.auth.userId);
    res.json(out);
}));
