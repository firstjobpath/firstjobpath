import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { leadsRouter } from "./routes/leads.js";
import { paymentsRouter } from "./routes/payments.js";
import { razorpayWebhookHandler } from "./routes/razorpay-webhook.js";
import { otpRouter } from "./routes/otp.js";
import { bookingsRouter } from "./routes/bookings.js";
import { mediaRouter } from "./routes/media.js";
import { aiRouter } from "./routes/ai-routes.js";
import { adminRouter } from "./routes/admin.js";
import { analyticsUserRouter } from "./routes/analytics-user.js";
import { coursesPublicRouter } from "./routes/courses-public.js";
import { startNotificationWorker } from "./jobs/notification.worker.js";
const app = express();
const corsOrigins = process.env.CORS_ORIGIN?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? ["http://localhost:3000"];
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cookieParser());
app.use(cors({
    origin: corsOrigins,
    credentials: true,
}));
app.post("/api/payments/webhook/razorpay", express.raw({ type: "application/json" }), (req, res, next) => {
    void razorpayWebhookHandler(req, res).catch(next);
});
app.use(express.json({ limit: "2mb" }));
const standardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
});
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 80,
    standardHeaders: true,
    legacyHeaders: false,
});
app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "firstjobpath-api", site: "FirstJobPath" });
});
app.use(standardLimiter);
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/leads", authLimiter, leadsRouter);
app.use("/api/payments", authLimiter, paymentsRouter);
app.use("/api/otp", otpRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/media", mediaRouter);
app.use("/api/ai", authLimiter, aiRouter);
app.use("/api/admin", adminRouter);
app.use("/api/analytics", analyticsUserRouter);
app.use("/api/courses", coursesPublicRouter);
app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
});
app.use(errorHandler);
const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
    console.log(`FirstJobPath API listening on http://localhost:${port}`);
    startNotificationWorker();
});
