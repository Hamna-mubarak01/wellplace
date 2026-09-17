import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import {
  ALERT_KINDS,
  ALERT_SEVERITY,
  alertKey,
  reconcileAlerts,
  scanForAlerts,
  type AlertScan,
  type AlertThresholds,
  type BookingFact,
} from "@/lib/domain/alerts";

const at = (isoLocal: string) => new Date(`${isoLocal}+04:00`);

const NOW = at("2026-09-14T12:00:00");

const thresholds: AlertThresholds = {
  holdExpiryWarningMinutes: requireSetting(
    EMPTY_SNAPSHOT,
    "reception.hold_expiry_warning_minutes",
  ),
  arrivalOverdueMinutes: requireSetting(
    EMPTY_SNAPSHOT,
    "reception.arrival_overdue_minutes",
  ),
  checkinOverdueMinutes: requireSetting(
    EMPTY_SNAPSHOT,
    "reception.checkin_overdue_minutes",
  ),
  cleaningConfirmMinutes: requireSetting(
    EMPTY_SNAPSHOT,
    "reception.cleaning_confirm_minutes",
  ),
};

const booking = (over: Partial<BookingFact> = {}): BookingFact => ({
  bookingId: "b1",
  status: "confirmed",
  startsAt: at("2026-09-14T11:00:00"),
  endsAt: at("2026-09-14T14:00:00"),
  arrivedAt: null,
  checkedInAt: null,
  checkedOutAt: null,
  suiteId: "s1",
  paymentStatus: "paid",
  ...over,
});

const scan = (over: Partial<AlertScan> = {}): AlertScan => ({
  now: NOW,
  thresholds,
  holds: [],
  bookings: [],
  cleaning: [],
  messages: [],
  refunds: [],
  conflicts: [],
  ...over,
});

describe("§9.3 — the seven operational alerts", () => {
  it("reads every threshold from configuration, never a literal", () => {
    expect(thresholds.holdExpiryWarningMinutes).toBe(3);
    expect(thresholds.arrivalOverdueMinutes).toBe(10);
    expect(thresholds.checkinOverdueMinutes).toBe(15);
    expect(thresholds.cleaningConfirmMinutes).toBe(30);
  });

  it("gives every kind a severity", () => {
    for (const kind of ALERT_KINDS) {
      expect(ALERT_SEVERITY[kind]).toBeDefined();
    }
  });

  it("raises nothing when the venue is running cleanly", () => {
    expect(
      scanForAlerts(
        scan({ bookings: [booking({ arrivedAt: at("2026-09-14T11:00:00"), checkedInAt: at("2026-09-14T11:02:00") })] }),
      ),
    ).toHaveLength(0);
  });

  it("[CLIENT] no longer warns about incomplete payment holds", () => {
    const found = scanForAlerts(
      scan({
        holds: [
          { occupancyId: "o1", expiresAt: at("2026-09-14T12:02:00") },
          { occupancyId: "o2", expiresAt: at("2026-09-14T12:09:00") },
        ],
      }),
    );

    expect(found).toHaveLength(0);
  });

  it("does not warn about a hold that has already expired", () => {
    const found = scanForAlerts(
      scan({ holds: [{ occupancyId: "o1", expiresAt: at("2026-09-14T11:59:00") }] }),
    );

    expect(found).toHaveLength(0);
  });

  it("raises the §8.2 alert when a payment succeeded with no suite secured", () => {
    const found = scanForAlerts(scan({ bookings: [booking({ suiteId: null })] }));

    expect(found[0]?.kind).toBe("payment_without_suite");
    expect(found[0]?.severity).toBe("critical");
  });

  it("raises a failed payment and a pending manual review separately", () => {
    expect(
      scanForAlerts(scan({ bookings: [booking({ paymentStatus: "failed", arrivedAt: NOW })] }))[0]
        ?.kind,
    ).toBe("payment_failed");
    expect(
      scanForAlerts(
        scan({ bookings: [booking({ paymentStatus: "manual_review", arrivedAt: NOW })] }),
      )[0]?.kind,
    ).toBe("manual_review_pending");
  });

  it("raises an overdue arrival only once the threshold has passed", () => {
    const late = scanForAlerts(scan({ bookings: [booking()] }));
    expect(late.some((a) => a.kind === "arrival_overdue")).toBe(true);

    const notYet = scanForAlerts(
      scan({ bookings: [booking({ startsAt: at("2026-09-14T11:55:00") })] }),
    );
    expect(notYet.some((a) => a.kind === "arrival_overdue")).toBe(false);
  });

  it("[CLIENT] stops arrival reminders once the guest is there without a separate check-in reminder", () => {
    const found = scanForAlerts(
      scan({ bookings: [booking({ arrivedAt: at("2026-09-14T11:40:00") })] }),
    );

    expect(found.some((a) => a.kind === "arrival_overdue")).toBe(false);
    expect(found.some((a) => a.kind === "checkin_overdue")).toBe(false);
  });

  it("[CLIENT] does not issue cleaning confirmation reminders", () => {
    const found = scanForAlerts(
      scan({
        cleaning: [
          { cleaningTaskId: "c1", suiteId: "s1", dueFrom: at("2026-09-14T11:00:00"), confirmedAt: null },
          { cleaningTaskId: "c2", suiteId: "s2", dueFrom: at("2026-09-14T11:00:00"), confirmedAt: at("2026-09-14T11:10:00") },
        ],
      }),
    );

    expect(found).toHaveLength(0);
  });

  it("raises a failed message and a pending refund", () => {
    const found = scanForAlerts(
      scan({
        messages: [{ messageId: "m1", bookingId: "b1", failedAt: at("2026-09-14T11:00:00") }],
        refunds: [{ refundId: "r1", bookingId: "b1", isPending: true }],
      }),
    );

    expect(found.map((a) => a.kind).sort()).toEqual(["message_failed", "refund_pending"]);
  });

  it("raises an upcoming conflict, but not one already in the past", () => {
    const found = scanForAlerts(
      scan({
        conflicts: [
          { occupancyId: "o1", suiteId: "s1", bookingId: "b1", cause: "block", startsAt: at("2026-09-14T15:00:00") },
          { occupancyId: "o2", suiteId: "s2", bookingId: null, cause: "maintenance", startsAt: at("2026-09-14T09:00:00") },
        ],
      }),
    );

    expect(found.map((a) => a.entityId)).toEqual(["o1"]);
  });
});

describe("alerts open and resolve without duplicating", () => {
  it("opens only what is not already open", () => {
    const detected = scanForAlerts(scan({ bookings: [booking({ suiteId: null })] }));
    const already = detected.map(alertKey);

    expect(reconcileAlerts(detected, already).toOpen).toHaveLength(0);
    expect(reconcileAlerts(detected, []).toOpen).toHaveLength(detected.length);
  });

  it("resolves an open alert whose condition has cleared", () => {
    const stale = "arrival_overdue:public.bookings:b9";
    const result = reconcileAlerts([], [stale]);

    expect(result.toResolve).toEqual([stale]);
    expect(result.toOpen).toHaveLength(0);
  });
});
