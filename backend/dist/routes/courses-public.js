import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
export const coursesPublicRouter = Router();
coursesPublicRouter.get("/", asyncHandler(async (_req, res) => {
    const courses = await prisma.course.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { mentor: { select: { name: true, id: true } } },
    });
    res.json({ courses });
}));
