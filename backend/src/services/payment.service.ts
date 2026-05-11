import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getRazorpay, verifyPaymentSignature } from "./razorpay.service.js";
import { validateCoupon, incrementCouponUse } from "./coupon.service.js";
import { createInvoiceForPayment } from "./invoice.service.js";
import { enqueueNotification } from "./notification.service.js";
import { awardXp } from "./gamification.service.js";
import { auditLog } from "./audit.service.js";

export async function createRazorpayOrder(input: {
  userId: string;
  courseId?: string;
  bookingId?: string;
  couponCode?: string;
}) {
  let amount = new Prisma.Decimal(0);
  let courseId: string | undefined;

  if (input.courseId) {
    const course = await prisma.course.findUnique({ where: { id: input.courseId } });
    if (!course) throw Object.assign(new Error("Course not found"), { status: 404 });
    amount = course.price;
    courseId = course.id;
  }

  if (input.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: { course: true },
    });
    if (!booking) throw Object.assign(new Error("Booking not found"), { status: 404 });
    if (booking.studentId !== input.userId) throw Object.assign(new Error("Forbidden"), { status: 403 });
    amount = booking.course.price;
    courseId = booking.courseId;
  }

  if (amount.equals(0)) {
    throw Object.assign(new Error("Amount required: pass courseId or bookingId"), { status: 400 });
  }

  let couponId: string | undefined;
  if (input.couponCode) {
    const v = await validateCoupon(input.couponCode, amount);
    if (!v.ok) throw Object.assign(new Error(v.error), { status: 400 });
    amount = v.total;
    couponId = v.couponId;
  }

  const payment = await prisma.payment.create({
    data: {
      userId: input.userId,
      amount,
      currency: "INR",
      status: "CREATED",
      courseId,
      bookingId: input.bookingId ?? null,
      couponId: couponId ?? null,
    },
  });

  const rz = getRazorpay();
  const paise = Math.max(100, Math.round(Number(amount) * 100));
  const order = await rz.orders.create({
    amount: paise,
    currency: "INR",
    receipt: payment.id.replace(/-/g, "").slice(0, 40),
    notes: { paymentId: payment.id },
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "PENDING",
      razorpayOrderId: order.id,
      metadata: order as object as Prisma.InputJsonValue,
    },
  });

  return {
    paymentId: payment.id,
    orderId: order.id,
    amount: paise,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID,
  };
}

export async function verifyStudentPayment(input: {
  userId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  if (
    !verifyPaymentSignature(
      input.razorpay_order_id,
      input.razorpay_payment_id,
      input.razorpay_signature,
    )
  ) {
    throw Object.assign(new Error("Invalid payment signature"), { status: 400 });
  }

  const payment = await prisma.payment.findFirst({
    where: { userId: input.userId, razorpayOrderId: input.razorpay_order_id },
  });
  if (!payment) throw Object.assign(new Error("Payment not found"), { status: 404 });

  return fulfillPayment(payment.id, input.razorpay_payment_id);
}

async function fulfillPayment(paymentId: string, razorpayPaymentId: string) {
  const current = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true },
  });
  if (!current) throw Object.assign(new Error("Payment not found"), { status: 404 });
  if (current.status === "PAID") {
    let invoice = await prisma.invoice.findUnique({ where: { paymentId } });
    if (!invoice) {
      invoice = await createInvoiceForPayment({
        paymentId: current.id,
        amount: current.amount,
        currency: current.currency,
        userName: current.user.name,
        userEmail: current.user.email,
        lineTitle: current.courseId ? "Course enrollment" : "Booking payment",
      });
    }
    return { payment: current, invoice };
  }

  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "PAID",
      razorpayPaymentId,
      failureReason: null,
    },
    include: { user: true },
  });

  await prisma.paymentTransaction.create({
    data: {
      paymentId: payment.id,
      type: "CAPTURE",
      amount: payment.amount,
      status: "completed",
      externalRef: razorpayPaymentId,
    },
  });

  if (payment.couponId) await incrementCouponUse(payment.couponId);

  if (payment.bookingId) {
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: { paymentStatus: "paid", status: "CONFIRMED" },
    });
  }

  const invoice = await createInvoiceForPayment({
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    userName: payment.user.name,
    userEmail: payment.user.email,
    lineTitle: payment.courseId ? "Course enrollment" : "Booking payment",
  });

  await enqueueNotification({
    userId: payment.userId,
    channel: "EMAIL",
    templateKey: "payment_receipt",
    payload: {
      to: payment.user.email,
      title: "Payment receipt",
      body: `Thank you. Invoice ${invoice.invoiceNumber} for ₹${payment.amount}.`,
    },
  });

  await awardXp(payment.userId, 25);

  return { payment, invoice };
}

export async function fulfillPaymentFromWebhook(orderId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId: orderId },
  });
  if (!payment) return { ok: false as const, reason: "payment_not_found" };
  if (payment.status === "PAID") return { ok: true as const };
  await fulfillPayment(payment.id, paymentId);
  return { ok: true as const };
}

export async function listPaymentsForUser(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { invoice: true, course: { select: { title: true } } },
  });
}

export async function refundPaymentStructure(paymentId: string, adminUserId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment?.razorpayPaymentId) {
    throw Object.assign(new Error("No Razorpay payment to refund"), { status: 400 });
  }
  /** Full refund via Razorpay API — wire when production keys exist */
  try {
    const rz = getRazorpay();
    await rz.payments.refund(payment.razorpayPaymentId, { amount: Math.round(Number(payment.amount) * 100) });
  } catch {
    await prisma.paymentTransaction.create({
      data: {
        paymentId,
        type: "REFUND",
        amount: payment.amount,
        status: "pending_manual",
        externalRef: null,
      },
    });
    throw Object.assign(new Error("Refund queued for manual processing"), { status: 202 });
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "REFUNDED" },
  });
  await prisma.paymentTransaction.create({
    data: {
      paymentId,
      type: "REFUND",
      amount: payment.amount,
      status: "completed",
      externalRef: payment.razorpayPaymentId,
    },
  });

  await auditLog({
    userId: adminUserId,
    action: "payment.refund",
    resource: "payment",
    resourceId: paymentId,
  });

  return { ok: true };
}
