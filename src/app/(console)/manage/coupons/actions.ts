"use server";
import { revalidatePath } from "next/cache";
import { requireManagement } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  couponBatchSchema,
  couponPreviewSchema,
  couponSchema,
} from "@/lib/config/coupons";
import { writeCoupon } from "@/lib/db/coupons";
import { createCouponBatch, type CouponBatchResult } from "@/lib/services/coupon-batch-service";
import { previewCouponIncome, type CouponPreviewResult } from "@/lib/services/coupon-preview-service";
import { consoleEdit } from "@/lib/validation/audit-reason";
export async function saveCoupon(raw: unknown) {
  await requireManagement();
  const parsed = couponSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false as const, message: parsed.error.issues[0].message };
  const result = await writeCoupon(await createClient(), { ...parsed.data, reason: consoleEdit("Coupon") });
  if (result.ok) {
    revalidatePath("/manage/coupons");
    revalidatePath("/book");
  }
  return result;
}
export async function previewCoupon(raw: unknown): Promise<CouponPreviewResult> {
  await requireManagement();
  const parsed = couponPreviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  return previewCouponIncome(await createClient(), parsed.data);
}
export async function generateCouponBatch(raw: unknown): Promise<CouponBatchResult> {
  await requireManagement();
  const parsed = couponBatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, conflicts: [] };
  const result = await createCouponBatch(await createClient(), parsed.data);
  if (result.ok) {
    revalidatePath("/manage/coupons");
    revalidatePath("/book");
  }
  return result;
}
