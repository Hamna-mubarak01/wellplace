import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT } from "@/lib/config";
import { thresholdsFrom } from "@/lib/services/alert-service";
import {
  ALERT_KINDS,
  ALERT_SEVERITY,
  scanForAlerts,
  type AlertKind,
  type AlertScan,
} from "@/lib/domain/alerts";
import { ALERT_LABEL } from "@/components/console/reception/alert-list";

const ALERT_LIST_SOURCE = readFileSync(
  "src/components/console/reception/alert-list.tsx",
  "utf8",
);

const ALERT_ACTIONS_SOURCE = readFileSync(
  "src/components/console/reception/alert-actions.tsx",
  "utf8",
);

const NOW = new Date("2026-09-14T10:00:00+04:00");
const THRESHOLDS = thresholdsFrom(EMPTY_SNAPSHOT);

const minutesBefore = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000);

const minutesAfter = (minutes: number) =>
  new Date(NOW.getTime() + minutes * 60_000);

const EVERY_CONDITION: AlertScan = {
  now: NOW,
  thresholds: THRESHOLDS,
  holds: [
    {
      occupancyId: "o-expiring",
      expiresAt: minutesAfter(THRESHOLDS.holdExpiryWarningMinutes - 1),
    },
  ],
  bookings: [
    {
      bookingId: "b-paid-no-suite",
      status: "awaiting_recovery",
      startsAt: minutesAfter(120),
      endsAt: minutesAfter(240),
      arrivedAt: null,
      checkedInAt: null,
      checkedOutAt: null,
      suiteId: null,
      paymentStatus: "paid",
    },
    {
      bookingId: "b-payment-failed",
      status: "payment_failed",
      startsAt: minutesAfter(120),
      endsAt: minutesAfter(240),
      arrivedAt: null,
      checkedInAt: null,
      checkedOutAt: null,
      suiteId: "s-1",
      paymentStatus: "failed",
    },
    {
      bookingId: "b-manual-review",
      status: "awaiting_payment",
      startsAt: minutesAfter(120),
      endsAt: minutesAfter(240),
      arrivedAt: null,
      checkedInAt: null,
      checkedOutAt: null,
      suiteId: "s-2",
      paymentStatus: "manual_review",
    },
    {
      bookingId: "b-arrival-overdue",
      status: "confirmed",
      startsAt: minutesBefore(THRESHOLDS.arrivalOverdueMinutes + 1),
      endsAt: minutesAfter(120),
      arrivedAt: null,
      checkedInAt: null,
      checkedOutAt: null,
      suiteId: "s-3",
      paymentStatus: "paid",
    },
    {
      bookingId: "b-checkin-overdue",
      status: "confirmed",
      startsAt: minutesBefore(180),
      endsAt: minutesAfter(60),
      arrivedAt: minutesBefore(THRESHOLDS.checkinOverdueMinutes + 1),
      checkedInAt: null,
      checkedOutAt: null,
      suiteId: "s-4",
      paymentStatus: "paid",
    },
  ],
  cleaning: [
    {
      cleaningTaskId: "t-unconfirmed",
      suiteId: "s-5",
      dueFrom: minutesBefore(THRESHOLDS.cleaningConfirmMinutes + 1),
      confirmedAt: null,
    },
  ],
  messages: [
    { messageId: "m-failed", bookingId: "b-payment-failed", failedAt: minutesBefore(5) },
  ],
  refunds: [
    { refundId: "r-pending", bookingId: "b-payment-failed", isPending: true },
  ],
  conflicts: [
    {
      occupancyId: "o-conflict",
      suiteId: "s-6",
      bookingId: null,
      cause: "block",
      startsAt: minutesAfter(30),
    },
  ],
};

const ONE_CLICK_REMEDIATION: Readonly<Record<string, string>> = {
  cleaning_unconfirmed: "confirmCleaning",
  arrival_overdue: "recordArrival",
  checkin_overdue: "checkIn",
};

const ROUTABLE_ENTITIES = [
  "public.bookings",
  "public.cleaning_tasks",
  "public.suite_occupancy",
];

describe("§9.3 — every alert the sweep can raise is one Reception can act on", () => {
  it("[CLIENT] raises the seven active kinds and retires redundant reminders", () => {
    const detected = scanForAlerts(EVERY_CONDITION);

    expect([...new Set(detected.map((alert) => alert.kind))].toSorted()).toEqual(
      ALERT_KINDS.filter((kind) => !["checkin_overdue", "cleaning_unconfirmed", "hold_expiring"].includes(kind)).toSorted(),
    );
  });

  it("gives every raised alert the severity its kind declares", () => {
    for (const alert of scanForAlerts(EVERY_CONDITION)) {
      expect(alert.severity, alert.kind).toBe(ALERT_SEVERITY[alert.kind]);
    }
  });

  it("names an entity the console can open for every kind that has a destination", () => {
    const routable = scanForAlerts(EVERY_CONDITION).filter((alert) =>
      ROUTABLE_ENTITIES.includes(alert.entity),
    );

    expect(routable.map((alert) => alert.kind).toSorted()).toEqual(
      [
        "arrival_overdue",
        "manual_review_pending",
        "payment_failed",
        "payment_without_suite",
        "upcoming_conflict",
      ].toSorted(),
    );
  });

  it("writes guidance for every kind, so no alert arrives without a next step [§5.5]", () => {
    for (const kind of ALERT_KINDS) {
      expect(ALERT_LIST_SOURCE, kind).toContain(`${kind}:`);
      expect(ALERT_LABEL[kind], kind).toBeTruthy();
    }
  });
});

describe("§9.3 — the one-click remediation exists exactly where the desk can finish the job here", () => {
  for (const [kind, action] of Object.entries(ONE_CLICK_REMEDIATION)) {
    it(`resolves ${kind.replaceAll("_", " ")} by calling ${action}`, () => {
      expect(ALERT_ACTIONS_SOURCE).toContain(`kind === "${kind}"`);
      expect(ALERT_ACTIONS_SOURCE).toContain(`${action}(entityId`);
    });
  }

  const WITHOUT_REMEDIATION = ALERT_KINDS.filter(
    (kind: AlertKind) => !(kind in ONE_CLICK_REMEDIATION),
  );

  for (const kind of WITHOUT_REMEDIATION) {
    it(`offers no one-click button for ${kind.replaceAll("_", " ")}, which needs a decision elsewhere`, () => {
      expect(ALERT_ACTIONS_SOURCE).not.toContain(`kind === "${kind}"`);
    });
  }

  it("accounts for every kind either way", () => {
    expect(
      Object.keys(ONE_CLICK_REMEDIATION).length + WITHOUT_REMEDIATION.length,
    ).toBe(ALERT_KINDS.length);
  });
});
