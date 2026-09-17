import { formatDubaiDateTime, formatDubaiTime } from "@/lib/domain/time";
import {
  BOOKING_SOURCE_LABEL,
  BOOKING_STATUS_LABEL,
  type BookingSource,
} from "@/components/console/reception/booking-filters";
import type { BookingStatus } from "@/lib/domain/booking";

export function statusLabel(status: BookingStatus): string {
  return BOOKING_STATUS_LABEL[status];
}

export function sourceLabel(source: BookingSource): string {
  return BOOKING_SOURCE_LABEL[source];
}

export type StatusTone = "brand" | "success" | "warning" | "danger" | "muted";

export const STATUS_TONE: Readonly<Record<BookingStatus, StatusTone>> = {
  draft: "muted",
  held: "warning",
  awaiting_payment: "warning",
  payment_failed: "danger",
  hold_expired: "muted",
  awaiting_recovery: "danger",
  confirmed: "brand",
  checked_in: "success",
  completed: "muted",
  rescheduled: "muted",
  cancelled: "muted",
  no_show: "danger",
  abandoned: "muted",
};

export const STATUS_TONE_CLASS: Readonly<Record<StatusTone, string>> = {
  brand: "border-brand bg-brand-wash text-text-primary",
  success: "border-success-border bg-success-wash text-success-ink",
  warning: "border-warning-border bg-warning-wash text-warning-ink",
  danger: "border-danger-border bg-danger-wash text-danger-ink",
  muted: "border-border-strong bg-surface-sunken text-text-secondary",
};

export function guestSummary(adults: number, children: number): string {
  const parts = [`${adults} ${adults === 1 ? "adult" : "adults"}`];
  if (children > 0) {
    parts.push(`${children} ${children === 1 ? "child" : "children"}`);
  }
  return parts.join(", ");
}

export function whenSummary(startsAt: string, endsAt: string): string {
  return `${formatDubaiDateTime(startsAt)} – ${formatDubaiTime(endsAt)}`;
}
