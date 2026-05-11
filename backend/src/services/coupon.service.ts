import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function validateCoupon(code: string, subtotal: Prisma.Decimal) {
  const coupon = await prisma.coupon.findFirst({
    where: {
      code: code.toUpperCase(),
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (!coupon) return { ok: false as const, error: "Invalid or expired coupon" };
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false as const, error: "Coupon usage limit reached" };
  }

  const sub = Number(subtotal);
  let discount = 0;
  if (coupon.discountType === "PERCENT") {
    discount = (sub * Number(coupon.value)) / 100;
  } else {
    discount = Number(coupon.value);
  }
  discount = Math.min(discount, sub);
  const total = Math.max(0, sub - discount);
  return {
    ok: true as const,
    couponId: coupon.id,
    discount: new Prisma.Decimal(discount),
    total: new Prisma.Decimal(total),
  };
}

export async function incrementCouponUse(couponId: string) {
  await prisma.coupon.update({
    where: { id: couponId },
    data: { usedCount: { increment: 1 } },
  });
}
