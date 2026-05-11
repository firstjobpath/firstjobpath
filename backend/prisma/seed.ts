import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password12345", 12);

  const users = [
    { email: "student@test.com", name: "Demo Student", role: "STUDENT" as const },
    { email: "mentor@test.com", name: "Demo Mentor", role: "MENTOR" as const },
    { email: "admin@test.com", name: "Demo Admin", role: "ADMIN" as const },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { password, name: u.name, role: u.role },
      create: {
        email: u.email,
        name: u.name,
        password,
        role: u.role,
      },
    });
  }

  const mentor = await prisma.user.findUniqueOrThrow({ where: { email: "mentor@test.com" } });

  await prisma.course.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Interview mastery bootcamp",
      description: "Behavioral + technical prep with weekly mocks.",
      price: 4999,
      mentorId: mentor.id,
      thumbnail: null,
    },
  });

  await prisma.coupon.upsert({
    where: { code: "LAUNCH10" },
    update: {},
    create: {
      code: "LAUNCH10",
      discountType: "PERCENT",
      value: 10,
      maxUses: 1000,
      active: true,
    },
  });

  const achievements = [
    { slug: "first-login", title: "First step", description: "Completed profile onboarding", xpReward: 50 },
    { slug: "payment-hero", title: "Invested in yourself", description: "Completed first payment", xpReward: 100 },
  ];
  for (const a of achievements) {
    await prisma.achievement.upsert({
      where: { slug: a.slug },
      update: {},
      create: a,
    });
  }

  const start = new Date();
  start.setHours(start.getHours() + 24);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  await prisma.mentorAvailability.deleteMany({ where: { mentorId: mentor.id } });
  await prisma.mentorAvailability.createMany({
    data: [
      { mentorId: mentor.id, startTime: start, endTime: end, seatsTotal: 3, seatsTaken: 0 },
      {
        mentorId: mentor.id,
        startTime: new Date(start.getTime() + 86400000),
        endTime: new Date(end.getTime() + 86400000),
        seatsTotal: 2,
        seatsTaken: 0,
      },
    ],
  });

  console.log("Seed complete. Demo logins (password: password12345):");
  for (const u of users) console.log(`  ${u.role.toLowerCase()}: ${u.email}`);
  console.log("Sample course id: 00000000-0000-4000-8000-000000000001");
  console.log("Coupon: LAUNCH10 (10% off)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
