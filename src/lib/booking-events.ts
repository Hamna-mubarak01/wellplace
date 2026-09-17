import {
  COOKIE_STORAGE_KEY,
  DEFAULT_COOKIE_CHOICE,
} from "@/lib/config/cookies";
import type { CheckoutProgress } from "@/lib/config/checkout-flow";
export function trackBookingStep(
  event: "booking_step_completed" | "booking_payment_result",
  progress: CheckoutProgress,
  totalFils?: number,
  outcome?: string,
) {
  if (typeof window === "undefined") return;
  try {
    const choice = JSON.parse(
      localStorage.getItem(COOKIE_STORAGE_KEY) ?? "null",
    );
    if ((choice?.c?.analytics ?? DEFAULT_COOKIE_CHOICE.analytics) === false)
      return;
    const target = window as Window & { dataLayer?: unknown[] };
    target.dataLayer ??= [];
    target.dataLayer.push({
      event,
      booking_step: progress.lastCompletedStep,
      visit_date: progress.selection.date ?? null,
      duration_hours: progress.selection.durationHours,
      adults: progress.selection.adults,
      children: progress.selection.childAges.length,
      currency: "AED",
      value: totalFils === undefined ? undefined : totalFils / 100,
      payment_outcome: outcome,
    });
  } catch {
    return;
  }
}
