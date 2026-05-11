import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { analyzeResumeText, generateRoadmap, listAiReports } from "../services/ai.service.js";

export const aiRouter = Router();

aiRouter.post(
  "/resume",
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({ text: z.string().min(50).max(20000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const out = await analyzeResumeText(req.auth!.userId, parsed.data.text);
    res.json(out);
  }),
);

aiRouter.post(
  "/roadmap",
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      skills: z.array(z.string()),
      degree: z.string(),
      interests: z.array(z.string()),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const out = await generateRoadmap({ userId: req.auth!.userId, ...parsed.data });
    res.json(out);
  }),
);

aiRouter.get(
  "/reports",
  requireAuth,
  asyncHandler(async (req, res) => {
    const type = req.query.type as "RESUME" | "INTERVIEW" | "ROADMAP" | undefined;
    const rows = await listAiReports(req.auth!.userId, type);
    res.json({ reports: rows });
  }),
);
