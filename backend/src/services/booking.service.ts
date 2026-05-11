import { prisma } from "../lib/prisma.js";
import { enqueueNotification } from "./notification.service.js";

export async function listAvailableSlots(mentorId: string, from: Date, to: Date) {
  const rows = await prisma.mentorAvailability.findMany({
    where: {
      mentorId,
      startTime: { gte: from, lte: to },
    },
    orderBy: { startTime: "asc" },
  });
  return rows.filter((r) => r.seatsTaken < r.seatsTotal);
}

export async function createBookingWithSlot(input: {
  studentId: string;
  courseId: string;
  mentorAvailabilityId: string;
}) {
  const slot = await prisma.mentorAvailability.findUnique({
    where: { id: input.mentorAvailabilityId },
  });
  if (!slot) throw Object.assign(new Error("Slot not found"), { status: 404 });

  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
  if (!course || course.mentorId !== slot.mentorId) {
    throw Object.assign(new Error("Course does not match mentor slot"), { status: 400 });
  }

  if (slot.seatsTaken >= slot.seatsTotal) {
    const pos =
      (await prisma.bookingWaitlist.count({
        where: { mentorAvailabilityId: slot.id },
      })) + 1;
    await prisma.bookingWaitlist.create({
      data: {
        studentId: input.studentId,
        courseId: input.courseId,
        mentorAvailabilityId: slot.id,
        slotTime: slot.startTime,
        position: pos,
      },
    });
    return { waitlist: true as const, position: pos };
  }

  const booking = await prisma.booking.create({
    data: {
      studentId: input.studentId,
      courseId: input.courseId,
      slotTime: slot.startTime,
      paymentStatus: "pending",
      status: "PENDING",
      mentorAvailabilityId: slot.id,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  await prisma.mentorAvailability.update({
    where: { id: slot.id },
    data: { seatsTaken: { increment: 1 } },
  });

  const student = await prisma.user.findUnique({ where: { id: input.studentId } });
  if (student) {
    await enqueueNotification({
      userId: input.studentId,
      channel: "EMAIL",
      templateKey: "booking_confirmation",
      payload: {
        to: student.email,
        title: "Booking created",
        body: `Your session is reserved. Complete payment to confirm. Booking ID: ${booking.id}`,
      },
    });
  }

  return { waitlist: false as const, booking };
}
