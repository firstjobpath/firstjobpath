import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { signUploadParams } from "../services/cloudinary.service.js";

export const mediaRouter = Router();

mediaRouter.get(
  "/upload-signature",
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({ folder: z.string().min(1).max(120) });
    const parsed = schema.safeParse({ folder: req.query.folder });
    if (!parsed.success) {
      res.status(400).json({ error: "folder query required" });
      return;
    }
    const params = signUploadParams(parsed.data.folder);
    res.json(params);
  }),
);
