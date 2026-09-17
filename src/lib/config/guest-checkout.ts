import { z } from "zod";
import { visitLengthSchema } from "@/lib/config/registry";

export const GUEST_CHECKOUT = {
  cookieName: "wellplace-checkout",
  cookieMaxAgeSeconds: 86400,
  refreshMilliseconds: 30000,
  paymentOptions: [{ value: "card", label: "Card" }, { value: "tabby", label: "Tabby" }],
  simulationOption: { value: "simulation", label: "Simulation (test payment)", unavailableSuffix: "available soon" },
} as const;

export const guestStaySchema = z.object({
  startsAt: z.iso.datetime({ offset: true }),
  durationHours: visitLengthSchema,
  adults: z.number().int().positive(),
  childAges: z.array(z.number().int().nonnegative()),
  dateOfBirth: z.iso.date(),
}).strict();

export const GUEST_HOLD_SETTING_KEYS = [
  "hours.regular", "hours.seasonal", "hours.exceptions", "hours.closures",
  "booking.durations_hours", "booking.guests_min", "booking.guests_max",
  "booking.child_min_age", "booking.child_max_age", "booking.booker_min_age",
  "booking.start_interval_minutes", "booking.max_horizon_days", "cleaning.buffer_minutes", "hold.minutes",
] as const;

export const GUEST_FEE_SETTING_KEYS = ["fees.tabby.enabled", "fees.tabby.percent", "fees.tabby.label"] as const;
export type GuestStay = z.infer<typeof guestStaySchema>;
export type GuestHoldResult =
  | { ok: true; expiresAt: string }
  | { ok: false; message: string; chooseAnotherTime: boolean };
