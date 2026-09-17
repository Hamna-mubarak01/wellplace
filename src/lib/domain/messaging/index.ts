export type MessageChannel = "email" | "whatsapp";

export type MessageKind = "transactional" | "marketing";

export const BOOKING_TEMPLATE_KEYS = [
  "booking_confirmation",
  "payment_received",
  "payment_failed",
  "booking_rescheduled",
  "booking_cancelled",
  "refund_issued",
  "booking_reminder",
  "directions_and_parking",
  "review_request",
  "secure_link",
  "payment_link",
] as const;

export type BookingTemplateKey = (typeof BOOKING_TEMPLATE_KEYS)[number];

export const TEMPLATE_KIND: Readonly<Record<BookingTemplateKey, MessageKind>> = {
  booking_confirmation: "transactional",
  payment_received: "transactional",
  payment_failed: "transactional",
  booking_rescheduled: "transactional",
  booking_cancelled: "transactional",
  refund_issued: "transactional",
  booking_reminder: "transactional",
  directions_and_parking: "transactional",
  review_request: "marketing",
  secure_link: "transactional",
  payment_link: "transactional",
};

export interface SendPolicy {
  readonly marketingEnabled: boolean;
  readonly templateActive: boolean;
  readonly channelEnabled: boolean;
}

export type SendVerdict =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: SendRefusal };

export type SendRefusal =
  | "marketing_disabled"
  | "template_inactive"
  | "channel_unavailable";

export function maySend(
  key: BookingTemplateKey,
  policy: SendPolicy,
): SendVerdict {
  if (!policy.channelEnabled) {
    return { allowed: false, reason: "channel_unavailable" };
  }

  if (!policy.templateActive) {
    return { allowed: false, reason: "template_inactive" };
  }

  if (TEMPLATE_KIND[key] === "marketing" && !policy.marketingEnabled) {
    return { allowed: false, reason: "marketing_disabled" };
  }

  return { allowed: true };
}

export function isMarketing(key: BookingTemplateKey): boolean {
  return TEMPLATE_KIND[key] === "marketing";
}

export const RESENDABLE_BY_RECEPTION: readonly BookingTemplateKey[] = [
  "booking_confirmation",
  "booking_reminder",
  "secure_link",
  "payment_link",
];

export function isResendableByReception(key: BookingTemplateKey): boolean {
  return RESENDABLE_BY_RECEPTION.includes(key);
}
