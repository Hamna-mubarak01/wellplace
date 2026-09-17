export const BOOKING_MESSAGE_KEYS = ["booking_confirmation", "payment_failed", "refund_issued"] as const;
export type BookingMessageKey = (typeof BOOKING_MESSAGE_KEYS)[number];

interface MessageCopy {
  readonly subject: string;
  readonly preheader: string;
  readonly eyebrow: string;
  readonly heading: string;
  readonly lead: string;
  readonly buttonLabel: string;
  readonly holdLine: string;
}

export const BOOKING_MESSAGE_COPY: Readonly<Record<BookingMessageKey, MessageCopy>> & {
  readonly footer: readonly string[];
  readonly simulationNote: string;
} = {
  booking_confirmation: {
    subject: "Your WellPlace booking is confirmed",
    preheader: "Your private suite is reserved. Your receipt is inside.",
    eyebrow: "Booking confirmed",
    heading: "You’re booked, {name}",
    lead: "Thank you for booking with WellPlace. Your private suite is reserved for the time below.",
    buttonLabel: "View your receipt",
    holdLine: "",
  },
  payment_failed: {
    subject: "Your WellPlace payment did not go through",
    preheader: "No money was taken. You can try again.",
    eyebrow: "Payment not completed",
    heading: "Your payment did not go through, {name}",
    lead: "Your payment was not completed, so nothing has been charged. You can return to the booking page and try again.",
    buttonLabel: "Return to your booking",
    holdLine: "Your time is held until {time} (Dubai time). Complete your payment before then to keep it.",
  },
  refund_issued: {
    subject: "Your WellPlace refund",
    preheader: "Details of the refund on your booking.",
    eyebrow: "Refund",
    heading: "About your refund, {name}",
    lead: "We have issued a refund on your booking. Card refunds usually reach your account within a few working days, depending on your bank.",
    buttonLabel: "View your receipt",
    holdLine: "",
  },
  footer: [
    "Questions about your booking? Simply reply to this email.",
    "WellPlace · Dubai, United Arab Emirates",
    "You are receiving this email because you made a booking with WellPlace.",
  ],
  simulationNote: "This booking was paid in test mode. No money was charged.",
};

export const TAX_DOCUMENT_ATTACHMENT_NOTE = {
  invoice: "Your tax invoice {number} is attached to this email as a PDF.",
  credit_note: "Your tax credit note {number} is attached to this email as a PDF.",
} as const;

export const RECOVERY_REFUND_LEAD =
  "Your payment reached us, but it could not be used for this booking: the time or coupon you chose was no longer available, the booking had changed, or it had already been paid. We have started a full refund of this payment, and our team will confirm once it has been processed. If you also received a booking confirmation from us, that booking is not affected. Reply to this email and we will gladly help.";
