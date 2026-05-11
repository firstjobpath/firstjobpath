import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { mentorAnalyticsSummary, studentAnalyticsSummary } from "../services/analytics.service.js";

export const analyticsUserRouter = Router();

analyticsUserRouter.get(
  "/student",
  requireAuth,
  requireRole(["STUDENT"]),
  asyncHandler(async (req, res) => {
    const summary = await studentAnalyticsSummary(req.auth!.userId);
    res.json(summary);
  }),
);

analyticsUserRouter.get(
  "/mentor",
  requireAuth,
  requireRole(["MENTOR"]),
  asyncHandler(async (req, res) => {
    const summary = await mentorAnalyticsSummary(req.auth!.userId);
    res.json(summary);
  }),
);
