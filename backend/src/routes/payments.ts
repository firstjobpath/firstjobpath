import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  createRazorpayOrder,
  listPaymentsForUser,
  verifyStudentPayment,
} from "../services/payment.service.js";
import { validateCoupon } from "../services/coupon.service.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const paymentsRouter = Router();

const orderSchema = z.object({
  courseId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  couponCode: z.string().optional(),
});

paymentsRouter.post(
  "/order",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    if (!body.courseId && !body.bookingId) {
      res.status(400).json({ error: "courseId or bookingId required" });
      return;
    }
    const out = await createRazorpayOrder({
      userId: req.auth!.userId,
      courseId: body.courseId,
      bookingId: body.bookingId,
      couponCode: body.couponCode,
    });
    res.json(out);
  }),
);

const verifySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

paymentsRouter.post(
  "/verify",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const result = await verifyStudentPayment({
      userId: req.auth!.userId,
      ...parsed.data,
    });
    res.json(result);
  }),
);

paymentsRouter.post(
  "/coupon/validate",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      code: z.string(),
      subtotal: z.number().positive(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const v = await validateCoupon(parsed.data.code, new Prisma.Decimal(parsed.data.subtotal));
    if (!v.ok) {
      res.status(400).json({ error: v.error });
      return;
    }
    res.json({
      ok: true,
      discount: v.discount.toString(),
      total: v.total.toString(),
    });
  }),
);

paymentsRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await listPaymentsForUser(req.auth!.userId);
    res.json({ payments: rows });
  }),
);

paymentsRouter.get(
  "/invoice/:paymentId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const paymentId = String(req.params.paymentId);
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId: req.auth!.userId },
      include: { invoice: true },
    });
    if (!payment?.invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    res.json({ invoice: payment.invoice, payment });
  }),
);
