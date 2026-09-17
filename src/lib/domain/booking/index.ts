export const BOOKING_STATUSES = [
  "draft",
  "held",
  "awaiting_payment",
  "payment_failed",
  "hold_expired",
  "awaiting_recovery",
  "confirmed",
  "checked_in",
  "completed",
  "rescheduled",
  "cancelled",
  "no_show",
  "abandoned",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const UNUSED_BOOKING_STATUSES: readonly BookingStatus[] = ["draft", "held", "hold_expired", "rescheduled"];

export const RECEPTION_BOOKING_STATUSES: readonly BookingStatus[] = [
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
  "awaiting_recovery",
];

export const SHOWN_BOOKING_STATUSES: readonly BookingStatus[] = BOOKING_STATUSES.filter(
  (status) => !UNUSED_BOOKING_STATUSES.includes(status),
);

export const BOOKING_ACTIONS = [
  "hold",
  "request_payment",
  "confirm",
  "fail_payment",
  "expire_hold",
  "recover",
  "record_arrival",
  "check_in",
  "check_out",
  "mark_no_show",
  "cancel",
  "reschedule",
  "extend",
  "move",
  "record_overrun",
  "abandon",
] as const;

export type BookingAction = (typeof BOOKING_ACTIONS)[number];

const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  draft: ["held", "abandoned"],
  held: ["awaiting_payment", "hold_expired", "abandoned", "cancelled"],
  awaiting_payment: ["confirmed", "payment_failed", "hold_expired", "awaiting_recovery", "cancelled"],
  payment_failed: ["awaiting_payment", "hold_expired", "awaiting_recovery", "cancelled"],
  hold_expired: ["awaiting_recovery", "abandoned"],
  awaiting_recovery: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "rescheduled", "cancelled", "no_show"],
  checked_in: ["completed"],
  completed: [],
  rescheduled: [],
  cancelled: [],
  no_show: [],
  abandoned: [],
};

const ACTION_RESULT: Readonly<
  Record<BookingAction, { readonly from: readonly BookingStatus[]; readonly to: BookingStatus | null }>
> = {
  hold: { from: ["draft"], to: "held" },
  request_payment: { from: ["held", "payment_failed"], to: "awaiting_payment" },
  confirm: { from: ["awaiting_payment", "awaiting_recovery"], to: "confirmed" },
  fail_payment: { from: ["awaiting_payment"], to: "payment_failed" },
  expire_hold: {
    from: ["held", "awaiting_payment", "payment_failed"],
    to: "hold_expired",
  },
  recover: { from: ["hold_expired", "awaiting_payment", "payment_failed"], to: "awaiting_recovery" },
  record_arrival: { from: ["confirmed"], to: null },
  check_in: { from: ["confirmed"], to: "checked_in" },
  check_out: { from: ["checked_in"], to: "completed" },
  mark_no_show: { from: ["confirmed"], to: "no_show" },
  cancel: {
    from: ["held", "awaiting_payment", "payment_failed", "awaiting_recovery", "confirmed"],
    to: "cancelled",
  },
  reschedule: { from: ["confirmed"], to: "confirmed" },
  extend: { from: ["confirmed", "checked_in"], to: null },
  move: { from: ["confirmed", "checked_in"], to: null },
  record_overrun: { from: ["checked_in", "completed"], to: null },
  abandon: { from: ["draft", "held", "hold_expired"], to: "abandoned" },
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: BookingStatus): readonly BookingStatus[] {
  return TRANSITIONS[from];
}

export function isTerminal(status: BookingStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function canPerform(action: BookingAction, from: BookingStatus): boolean {
  return ACTION_RESULT[action].from.includes(from);
}

export function statusAfter(
  action: BookingAction,
  from: BookingStatus,
): BookingStatus | null {
  if (!canPerform(action, from)) return null;
  return ACTION_RESULT[action].to ?? from;
}

export function allowedActions(from: BookingStatus): readonly BookingAction[] {
  return BOOKING_ACTIONS.filter((action) => canPerform(action, from));
}

export function isActiveClaim(status: BookingStatus): boolean {
  return (
    status === "held" ||
    status === "awaiting_payment" ||
    status === "payment_failed" ||
    status === "confirmed" ||
    status === "checked_in"
  );
}

export const MOVE_EARLIER_MESSAGE = "A booking can only move to a later time. Choose a start after the current one.";
export const MOVE_PAST_MESSAGE = "That time has already passed. Choose a later start time.";

export function moveStartRefusal(currentStartsAt: string, nextStartsAt: string, nowMs: number): string | null {
  const current = Date.parse(currentStartsAt);
  const next = Date.parse(nextStartsAt);
  if (!Number.isFinite(current) || !Number.isFinite(next) || next === current) return null;
  if (next < current) return MOVE_EARLIER_MESSAGE;
  if (next < nowMs) return MOVE_PAST_MESSAGE;
  return null;
}
