import nodemailer from "nodemailer";
import { SITE } from "../config/site.js";
import { genericHtml, otpEmailHtml, welcomeEmailHtml } from "./email-templates.js";
function getTransport() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass)
        return null;
    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}
export async function sendMail(to, subject, html) {
    const transport = getTransport();
    const from = process.env.SMTP_FROM ?? `${SITE.name} <${SITE.email}>`;
    if (!transport) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("SMTP not configured");
        }
        console.info("[email:dev]", { to, subject });
        return;
    }
    await transport.sendMail({ from, to, subject, html });
}
export async function sendTemplatedEmail(templateKey, payload) {
    switch (templateKey) {
        case "welcome": {
            const to = String(payload.to ?? "");
            const name = String(payload.name ?? "there");
            await sendMail(to, `Welcome to ${SITE.name}`, welcomeEmailHtml(name));
            break;
        }
        case "otp": {
            const to = String(payload.to ?? "");
            const code = String(payload.code ?? "");
            const purpose = String(payload.purpose ?? "verification");
            await sendMail(to, "Your verification code", otpEmailHtml(code, purpose));
            break;
        }
        case "booking_confirmation":
        case "payment_receipt":
        case "password_reset":
        case "class_reminder":
        case "placement_notification":
        case "certificate": {
            const to = String(payload.to ?? "");
            const title = String(payload.title ?? "Notification");
            const body = String(payload.body ?? "");
            await sendMail(to, title, genericHtml(title, body.replace(/\n/g, "<br/>")));
            break;
        }
        default:
            throw new Error(`Unknown template: ${templateKey}`);
    }
}
