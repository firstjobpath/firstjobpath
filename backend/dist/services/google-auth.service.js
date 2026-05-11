import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma.js";
const client = new OAuth2Client();
export async function verifyGoogleIdToken(idToken) {
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!audience)
        throw Object.assign(new Error("Google OAuth not configured"), { status: 503 });
    const ticket = await client.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    if (!payload?.email)
        throw Object.assign(new Error("Invalid Google token"), { status: 401 });
    return {
        googleId: payload.sub,
        email: payload.email.toLowerCase(),
        name: payload.name ?? payload.email.split("@")[0] ?? "User",
        picture: payload.picture,
    };
}
export async function findOrCreateGoogleUser(input, defaultRole = "STUDENT") {
    const existingGoogle = await prisma.user.findUnique({ where: { googleId: input.googleId } });
    if (existingGoogle)
        return existingGoogle;
    const byEmail = await prisma.user.findUnique({ where: { email: input.email } });
    if (byEmail) {
        if (byEmail.googleId && byEmail.googleId !== input.googleId) {
            throw Object.assign(new Error("Email already linked to another account"), { status: 409 });
        }
        return prisma.user.update({
            where: { id: byEmail.id },
            data: { googleId: input.googleId, emailVerified: true },
        });
    }
    return prisma.user.create({
        data: {
            email: input.email,
            name: input.name,
            googleId: input.googleId,
            role: defaultRole,
            emailVerified: true,
            password: null,
        },
    });
}
