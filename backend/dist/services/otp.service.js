import { createHmac, randomInt } from "crypto";
import { prisma } from "../lib/prisma.js";
import { enqueueNotification } from "./notification.service.js";
const PEPPER = process.env.OTP_PEPPER ?? "dev-pepper-change-in-production";
const TTL_MS = 10 * 60 * 1000;
function hashCode(code) {
    return createHmac("sha256", PEPPER).update(code).digest("hex");
}
export function generateOtpCode() {
    return String(randomInt(100000, 999999));
}
export async function requestOtp(input) {
    const code = generateOtpCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + TTL_MS);
    await prisma.otpCode.create({
        data: {
            destination: input.destination.toLowerCase(),
            channel: input.channel,
            purpose: input.purpose,
            codeHash,
            expiresAt,
        },
    });
    if (input.channel === "EMAIL") {
        await enqueueNotification({
            channel: "EMAIL",
            templateKey: "otp",
            payload: { to: input.destination, code, purpose: input.purpose },
        });
    }
    else {
        await enqueueNotification({
            channel: "SMS",
            templateKey: "otp_sms",
            payload: { to: input.destination, code, purpose: input.purpose },
        });
    }
    return { expiresInSec: Math.floor(TTL_MS / 1000) };
}
export async function verifyOtp(input) {
    const dest = input.destination.toLowerCase();
    const codeHash = hashCode(input.code);
    const row = await prisma.otpCode.findFirst({
        where: {
            destination: dest,
            channel: input.channel,
            purpose: input.purpose,
            consumedAt: null,
            expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
    });
    if (!row)
        return { ok: false, reason: "invalid_or_expired" };
    if (row.attempts >= 5)
        return { ok: false, reason: "too_many_attempts" };
    if (row.codeHash !== codeHash) {
        await prisma.otpCode.update({
            where: { id: row.id },
            data: { attempts: { increment: 1 } },
        });
        return { ok: false, reason: "invalid_code" };
    }
    await prisma.otpCode.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
    });
    return { ok: true };
}
