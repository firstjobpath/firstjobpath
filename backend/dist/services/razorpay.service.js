import Razorpay from "razorpay";
import crypto from "crypto";
let client = null;
export function getRazorpay() {
    if (!client) {
        const key = process.env.RAZORPAY_KEY_ID;
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!key || !secret) {
            throw Object.assign(new Error("Razorpay keys not configured"), { status: 503 });
        }
        client = new Razorpay({ key_id: key, key_secret: secret });
    }
    return client;
}
export function verifyPaymentSignature(orderId, paymentId, signature) {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret)
        return false;
    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return expected === signature;
}
export function verifyWebhookSignature(rawBody, signature) {
    if (!signature)
        return false;
    const whSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!whSecret)
        return false;
    const expected = crypto.createHmac("sha256", whSecret).update(rawBody).digest("hex");
    return expected === signature;
}
