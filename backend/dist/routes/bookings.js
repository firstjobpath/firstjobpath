import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { createBookingWithSlot, listAvailableSlots } from "../services/booking.service.js";
import { prisma } from "../lib/prisma.js";
export const bookingsRouter = Router();
bookingsRouter.get("/slots", asyncHandler(async (req, res) => {
    const schema = z.object({
        mentorId: z.string().uuid(),
        from: z.string().optional(),
        to: z.string().optional(),
    });
    const parsed = schema.safeParse({
        mentorId: req.query.mentorId,
        from: req.query.from,
        to: req.query.to,
    });
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
        return;
    }
    const from = parsed.data.from ? new Date(parsed.data.from) : new Date();
    const to = parsed.data.to ? new Date(parsed.data.to) : new Date(Date.now() + 14 * 86400000);
    const slots = await listAvailableSlots(parsed.data.mentorId, from, to);
    res.json({ slots });
}));
bookingsRouter.post("/", requireAuth, asyncHandler(async (req, res) => {
    const schema = z.object({
        courseId: z.string().uuid(),
        mentorAvailabilityId: z.string().uuid(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
        return;
    }
    const out = await createBookingWithSlot({
        studentId: req.auth.userId,
        ...parsed.data,
    });
    res.status(201).json(out);
}));
bookingsRouter.get("/mine", requireAuth, asyncHandler(async (req, res) => {
    const rows = await prisma.booking.findMany({
        where: { studentId: req.auth.userId },
        orderBy: { slotTime: "desc" },
        include: { course: { select: { title: true } } },
    });
    res.json({ bookings: rows });
}));
bookingsRouter.post("/:id/cancel", requireAuth, asyncHandler(async (req, res) => {
    const bookingId = String(req.params.id);
    const booking = await prisma.booking.findFirst({
        where: { id: bookingId, studentId: req.auth.userId },
    });
    if (!booking) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
    });
    if (booking.mentorAvailabilityId) {
        await prisma.mentorAvailability.updateMany({
            where: { id: booking.mentorAvailabilityId, seatsTaken: { gt: 0 } },
            data: { seatsTaken: { decrement: 1 } },
        });
    }
    res.json({ ok: true });
}));
