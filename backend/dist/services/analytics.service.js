import { prisma } from "../lib/prisma.js";
export async function adminAnalyticsSummary() {
    const [totalStudents, totalMentors, revenueAgg, paymentsFailed, bookingsConfirmed, placementsCount,] = await Promise.all([
        prisma.user.count({ where: { role: "STUDENT" } }),
        prisma.user.count({ where: { role: "MENTOR" } }),
        prisma.payment.aggregate({
            where: { status: "PAID" },
            _sum: { amount: true },
        }),
        prisma.payment.count({ where: { status: "FAILED" } }),
        prisma.booking.count({ where: { status: "CONFIRMED" } }),
        prisma.placement.count(),
    ]);
    const last30 = new Date(Date.now() - 30 * 86400000);
    const newStudents = await prisma.user.count({
        where: { role: "STUDENT", createdAt: { gte: last30 } },
    });
    return {
        users: { students: totalStudents, mentors: totalMentors, newStudents30d: newStudents },
        revenue: { totalInr: revenueAgg._sum.amount?.toString() ?? "0" },
        payments: { failed: paymentsFailed },
        bookings: { confirmed: bookingsConfirmed },
        placements: { tracked: placementsCount },
    };
}
export async function mentorAnalyticsSummary(mentorId) {
    const sessions = await prisma.mentorAvailability.count({ where: { mentorId } });
    const courses = await prisma.course.count({ where: { mentorId } });
    return { slots: sessions, courses };
}
export async function studentAnalyticsSummary(studentId) {
    const bookings = await prisma.booking.count({ where: { studentId } });
    const payments = await prisma.payment.count({ where: { userId: studentId, status: "PAID" } });
    const user = await prisma.user.findUnique({
        where: { id: studentId },
        select: { xp: true, level: true, streakDays: true },
    });
    return { bookings, paymentsCompleted: payments, gamification: user };
}
