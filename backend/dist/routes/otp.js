import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requestOtp, verifyOtp } from "../services/otp.service.js";
export const otpRouter = Router();
const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});
otpRouter.post("/request", otpLimiter, asyncHandler(async (req, res) => {
    const schema = z.object({
        destination: z.string().min(3),
        channel: z.enum(["EMAIL", "SMS"]),
        purpose: z.enum(["REGISTER", "LOGIN", "RESET_PASSWORD", "PHONE_VERIFY"]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
        return;
    }
    const out = await requestOtp(parsed.data);
    res.json(out);
}));
otpRouter.post("/verify", otpLimiter, asyncHandler(async (req, res) => {
    const schema = z.object({
        destination: z.string(),
        channel: z.enum(["EMAIL", "SMS"]),
        purpose: z.enum(["REGISTER", "LOGIN", "RESET_PASSWORD", "PHONE_VERIFY"]),
        code: z.string().length(6),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
        return;
    }
    const result = await verifyOtp(parsed.data);
    if (!result.ok) {
        res.status(400).json({ error: result.reason });
        return;
    }
    res.json({ verified: true });
}));
