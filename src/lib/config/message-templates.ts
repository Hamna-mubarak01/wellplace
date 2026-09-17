import type { BookingTemplateKey } from "@/lib/domain/messaging";

export const MESSAGE_SUBJECT_MAX = 300;
export const MESSAGE_BODY_MAX = 20000;
export const MESSAGE_TIMING_MAX = 525600;
export const MESSAGE_TIME_UNITS = { minutes: 1, hours: 60, days: 1440 } as const;
export type MessageTimeUnit = keyof typeof MESSAGE_TIME_UNITS;
export const MESSAGE_GROUPS = [
  { value: "booking", label: "Booking updates" },
  { value: "payments", label: "Payments" },
  { value: "visit", label: "Visit messages" },
] as const;
export const MESSAGE_TEMPLATE_COPY: Record<BookingTemplateKey, {
  label: string; purpose: string; help: string; event: string; group: typeof MESSAGE_GROUPS[number]["value"];
}> = {
  booking_confirmation: { label: "Booking confirmed", group: "booking", event: "booking confirmation", purpose: "Confirm the guest’s booking and explain what happens next.", help: "Use this message to confirm a successful booking. Include a clear summary of the visit and any important arrival instructions. A payment attempt alone is not a confirmed booking." },
  payment_received: { label: "Payment received", group: "payments", event: "payment confirmation", purpose: "Let the guest know their payment was received.", help: "Use this message to acknowledge a successful payment. Keep it separate from booking confirmation, which confirms the visit itself. Do not promise a receipt link unless one is provided." },
  payment_failed: { label: "Payment unsuccessful", group: "payments", event: "payment failure", purpose: "Explain that the payment did not go through and what to do next.", help: "Use reassuring wording and explain the next step. A guest may retry while their checkout hold is still valid. Do not promise their time is reserved indefinitely." },
  booking_rescheduled: { label: "Booking time changed", group: "booking", event: "booking change", purpose: "Confirm that the guest’s booking has been moved.", help: "Use this message after a booking’s date or time changes successfully. Make it clear that the updated visit replaces the original arrangement." },
  booking_cancelled: { label: "Booking cancelled", group: "booking", event: "booking cancellation", purpose: "Confirm the cancellation and explain the next steps.", help: "Use this message to confirm a cancelled booking. Cancellation does not always mean a refund, so avoid promising one unless it has been approved." },
  refund_issued: { label: "Refund issued", group: "payments", event: "refund confirmation", purpose: "Tell the guest their refund has been issued.", help: "Use this message for a confirmed refund. Explain any next steps without promising an arrival date that the payment provider has not confirmed." },
  booking_reminder: { label: "Visit reminder", group: "visit", event: "scheduled visit start", purpose: "Remind the guest about their upcoming visit.", help: "Use this message before the visit to remind the guest about arrival and preparation. Choose Before and a suitable number of hours or days in Planned timing." },
  directions_and_parking: { label: "Directions and parking", group: "visit", event: "scheduled visit start", purpose: "Help the guest find WellPlace and arrive comfortably.", help: "Include the confirmed address, a map link, parking instructions and any entrance details. Check these details whenever access or parking arrangements change." },
  review_request: { label: "Ask for a review", group: "visit", event: "visit end", purpose: "Invite the guest to share feedback after their visit.", help: "Use this message after the visit, with a polite invitation to leave feedback. This is a marketing message: disabling marketing must stop this request without stopping essential booking messages." },
  secure_link: { label: "Booking details link", group: "booking", event: "booking-link request", purpose: "Help the guest access their own booking details.", help: "Use this message when a guest needs their private booking link again. Each guest needs their own secure link; never paste another guest’s link into a reusable template." },
  payment_link: { label: "Request a payment", group: "payments", event: "payment-link request", purpose: "Ask the guest to pay for a booking arranged by Reception.", help: "Use this message to explain a payment request. Each booking needs its own payment link; never save a guest-specific payment link as reusable wording." },
};
