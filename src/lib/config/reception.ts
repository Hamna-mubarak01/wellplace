export const RECEPTION_BOOKING_SOURCE = "manual" as const;

export const RECEPTION_PAYMENT_METHODS = [
  "cash",
  "card_terminal",
  "payment_link",
  "complimentary",
] as const;

export type ReceptionPaymentMethod = (typeof RECEPTION_PAYMENT_METHODS)[number];

export const RECEPTION_PAYMENT_METHOD_LABEL: Readonly<
  Record<ReceptionPaymentMethod, string>
> = {
  cash: "Cash",
  card_terminal: "Card terminal",
  payment_link: "Payment link",
  complimentary: "Complimentary",
};

export const DESK_PAYMENT_METHODS = ["card_terminal", "cash"] as const;

export type DeskPaymentMethod = (typeof DESK_PAYMENT_METHODS)[number];

export const DESK_PAYMENT_METHOD_LABEL: Readonly<Record<DeskPaymentMethod, string>> = {
  card_terminal: "Card",
  cash: "Cash",
};

export function isReceptionPaymentMethod(
  value: unknown,
): value is ReceptionPaymentMethod {
  return (
    typeof value === "string" &&
    (RECEPTION_PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABEL: Readonly<Record<TaskPriority, string>> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};
