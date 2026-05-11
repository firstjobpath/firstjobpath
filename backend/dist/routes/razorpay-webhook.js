import { fulfillPaymentFromWebhook } from "../services/payment.service.js";
import { verifyWebhookSignature } from "../services/razorpay.service.js";
import { auditLog } from "../services/audit.service.js";
export async function razorpayWebhookHandler(req, res) {
    const signature = req.get("x-razorpay-signature");
    const raw = req.body instanceof Buffer ? req.body.toString("utf8") : String(req.body ?? "");
    if (!verifyWebhookSignature(raw, signature)) {
        res.status(400).json({ error: "Invalid webhook signature" });
        return;
    }
    let payload;
    try {
        payload = JSON.parse(raw);
    }
    catch {
        res.status(400).json({ error: "Invalid JSON" });
        return;
    }
    const event = payload.event;
    const orderId = payload.payload?.payment?.entity?.order_id;
    const payId = payload.payload?.payment?.entity?.id;
    if ((event === "payment.captured" || event === "order.paid") && orderId && payId) {
        await fulfillPaymentFromWebhook(orderId, payId);
    }
    await auditLog({
        action: "webhook.razorpay",
        resource: "payment",
        metadata: { event, orderId, payId },
    });
    res.json({ received: true });
}
