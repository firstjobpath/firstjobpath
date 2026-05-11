import OpenAI from "openai";
import { prisma } from "../lib/prisma.js";
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
export async function analyzeResumeText(userId, text) {
    let result;
    if (openai) {
        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an ATS and resume coach. Return strict JSON with keys: atsScore (0-100), missingSkills (string[]), keywords (string[]), formattingTips (string[]), summary (string).",
                },
                { role: "user", content: text.slice(0, 12000) },
            ],
            response_format: { type: "json_object" },
        });
        const raw = completion.choices[0]?.message?.content ?? "{}";
        result = JSON.parse(raw);
    }
    else {
        result = {
            atsScore: 72,
            missingSkills: ["System design", "Metrics storytelling"],
            keywords: ["React", "Node.js", "AWS"],
            formattingTips: ["Use one column layout", "Quantify impact with numbers"],
            summary: "OpenAI key not set — mock analysis. Add OPENAI_API_KEY for live ATS scoring.",
        };
    }
    const report = await prisma.aiReport.create({
        data: {
            userId,
            type: "RESUME",
            input: { excerpt: text.slice(0, 2000) },
            result: result,
        },
    });
    return { reportId: report.id, ...result };
}
export async function generateRoadmap(input) {
    let result;
    if (openai) {
        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Return JSON roadmap with keys: title, milestones (array of {name, weeks, skills}), certifications (string[]), jobReadiness (string).",
                },
                {
                    role: "user",
                    content: JSON.stringify(input),
                },
            ],
            response_format: { type: "json_object" },
        });
        const raw = completion.choices[0]?.message?.content ?? "{}";
        result = JSON.parse(raw);
    }
    else {
        result = {
            title: "Mock roadmap",
            milestones: [
                { name: "Strengthen DSA", weeks: 8, skills: ["Arrays", "Graphs"] },
                { name: "Ship portfolio project", weeks: 4, skills: ["React", "APIs"] },
            ],
            certifications: ["AWS Cloud Practitioner"],
            jobReadiness: "Add OPENAI_API_KEY for personalized output.",
        };
    }
    const report = await prisma.aiReport.create({
        data: {
            userId: input.userId,
            type: "ROADMAP",
            input: { skills: input.skills, degree: input.degree, interests: input.interests },
            result: result,
        },
    });
    return { reportId: report.id, ...result };
}
export async function listAiReports(userId, type) {
    return prisma.aiReport.findMany({
        where: { userId, ...(type ? { type } : {}) },
        orderBy: { createdAt: "desc" },
        take: 20,
    });
}
