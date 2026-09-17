import type { SettingsSnapshot } from "@/lib/config";
import type { GuestHoldResult, GuestStay } from "@/lib/config/guest-checkout";
import { reserveGuestHold, releaseGuestHold } from "@/lib/db/guest-checkout";
import { guestBookingRefusal } from "@/lib/services/guest-booking-rules";

export async function holdGuestVisit(token: string, stay: GuestStay, settings: SettingsSnapshot): Promise<GuestHoldResult> {
  const refusal = guestBookingRefusal(settings, stay);
  if (refusal) return { ok: false, message: refusal, chooseAnotherTime: true };
  return reserveGuestHold(token, stay, settings);
}
export async function releaseGuestVisit(token: string): Promise<void> {
  await releaseGuestHold(token);
}
