export const ALERT_KINDS = [
  "hold_expiring",
  "payment_without_suite",
  "payment_failed",
  "message_failed",
  "arrival_overdue",
  "checkin_overdue",
  "cleaning_unconfirmed",
  "upcoming_conflict",
  "refund_pending",
  "manual_review_pending",
] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];

export type AlertSeverity = "critical" | "warning" | "info";

export const ALERT_SEVERITY: Readonly<Record<AlertKind, AlertSeverity>> = {
  hold_expiring: "info",
  payment_without_suite: "critical",
  payment_failed: "critical",
  message_failed: "warning",
  arrival_overdue: "warning",
  checkin_overdue: "warning",
  cleaning_unconfirmed: "warning",
  upcoming_conflict: "critical",
  refund_pending: "warning",
  manual_review_pending: "warning",
};

export interface AlertThresholds {
  readonly holdExpiryWarningMinutes: number;
  readonly arrivalOverdueMinutes: number;
  readonly checkinOverdueMinutes: number;
  readonly cleaningConfirmMinutes: number;
}

export interface HoldFact {
  readonly occupancyId: string;
  readonly expiresAt: Date;
}

export interface BookingFact {
  readonly bookingId: string;
  readonly status: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly arrivedAt: Date | null;
  readonly checkedInAt: Date | null;
  readonly checkedOutAt: Date | null;
  readonly suiteId: string | null;
  readonly paymentStatus: string | null;
}

export interface CleaningFact {
  readonly cleaningTaskId: string;
  readonly suiteId: string;
  readonly dueFrom: Date;
  readonly confirmedAt: Date | null;
}

export interface MessageFact {
  readonly messageId: string;
  readonly bookingId: string | null;
  readonly failedAt: Date | null;
}

export interface RefundFact {
  readonly refundId: string;
  readonly bookingId: string;
  readonly isPending: boolean;
}

export interface ConflictFact {
  readonly occupancyId: string;
  readonly suiteId: string;
  readonly bookingId: string | null;
  readonly cause: "block" | "overrun" | "maintenance";
  readonly startsAt: Date;
}

export interface AlertScan {
  readonly now: Date;
  readonly thresholds: AlertThresholds;
  readonly holds: readonly HoldFact[];
  readonly bookings: readonly BookingFact[];
  readonly cleaning: readonly CleaningFact[];
  readonly messages: readonly MessageFact[];
  readonly refunds: readonly RefundFact[];
  readonly conflicts: readonly ConflictFact[];
}

export interface DetectedAlert {
  readonly kind: AlertKind;
  readonly severity: AlertSeverity;
  readonly entity: string;
  readonly entityId: string;
}

const MILLISECONDS_PER_MINUTE = 60_000;

function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MILLISECONDS_PER_MINUTE;
}

function alert(kind: AlertKind, entity: string, entityId: string): DetectedAlert {
  return { kind, severity: ALERT_SEVERITY[kind], entity, entityId };
}

export function holdExpiring(
  hold: HoldFact,
  now: Date,
  warningMinutes: number,
): boolean {
  const remaining = minutesBetween(now, hold.expiresAt);
  return remaining > 0 && remaining <= warningMinutes;
}

export function paymentWithoutSuite(booking: BookingFact): boolean {
  return booking.paymentStatus === "paid" && booking.suiteId === null;
}

export function arrivalOverdue(
  booking: BookingFact,
  now: Date,
  overdueMinutes: number,
): boolean {
  if (booking.status !== "confirmed") return false;
  if (booking.arrivedAt !== null) return false;
  return minutesBetween(booking.startsAt, now) >= overdueMinutes;
}

export function checkinOverdue(
  booking: BookingFact,
  now: Date,
  overdueMinutes: number,
): boolean {
  if (booking.arrivedAt === null) return false;
  if (booking.checkedInAt !== null) return false;
  return minutesBetween(booking.arrivedAt, now) >= overdueMinutes;
}

export function cleaningUnconfirmed(
  task: CleaningFact,
  now: Date,
  confirmMinutes: number,
): boolean {
  if (task.confirmedAt !== null) return false;
  return minutesBetween(task.dueFrom, now) >= confirmMinutes;
}

export function scanForAlerts(scan: AlertScan): readonly DetectedAlert[] {
  const { now, thresholds } = scan;
  const found: DetectedAlert[] = [];

  for (const booking of scan.bookings) {
    if (paymentWithoutSuite(booking)) {
      found.push(alert("payment_without_suite", "public.bookings", booking.bookingId));
    }
    if (booking.paymentStatus === "failed") {
      found.push(alert("payment_failed", "public.bookings", booking.bookingId));
    }
    if (booking.paymentStatus === "manual_review") {
      found.push(
        alert("manual_review_pending", "public.bookings", booking.bookingId),
      );
    }
    if (arrivalOverdue(booking, now, thresholds.arrivalOverdueMinutes)) {
      found.push(alert("arrival_overdue", "public.bookings", booking.bookingId));
    }
  }

  for (const message of scan.messages) {
    if (message.failedAt !== null) {
      found.push(alert("message_failed", "public.messages", message.messageId));
    }
  }

  for (const refund of scan.refunds) {
    if (refund.isPending) {
      found.push(alert("refund_pending", "public.refunds", refund.refundId));
    }
  }

  for (const conflict of scan.conflicts) {
    if (conflict.startsAt.getTime() >= now.getTime()) {
      found.push(
        alert("upcoming_conflict", "public.suite_occupancy", conflict.occupancyId),
      );
    }
  }

  return found;
}

export function alertKey(detected: DetectedAlert): string {
  return `${detected.kind}:${detected.entity}:${detected.entityId}`;
}

export interface AlertReconciliation {
  readonly toOpen: readonly DetectedAlert[];
  readonly toResolve: readonly string[];
}

export function reconcileAlerts(
  detected: readonly DetectedAlert[],
  openKeys: readonly string[],
): AlertReconciliation {
  const detectedKeys = new Set(detected.map(alertKey));
  const open = new Set(openKeys);

  return {
    toOpen: detected.filter((item) => !open.has(alertKey(item))),
    toResolve: openKeys.filter((key) => !detectedKeys.has(key)),
  };
}
