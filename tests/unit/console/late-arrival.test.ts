import { describe, expect, it } from "vitest";

import type { BookingDetail } from "@/lib/db/queries/bookings";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/domain/booking";
import { lateArrivalMinutes } from "@/lib/domain/overrun";
import { canRecordLateArrival } from "@/components/console/reception/late-arrival-dialog";

const dubai = (isoLocal: string) => `${isoLocal}+04:00`;

const START = dubai("2026-09-14T10:00:00");

function booking(over: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: "b0000000-0000-4000-8000-000000000001",
    reference: "WP000001",
    status: "confirmed",
    source: "walk_in",
    suiteId: "s0000000-0000-4000-8000-000000000001",
    suiteNumber: 3,
    guestName: "Test Guest",
    guestEmail: "guest@example.test",
    guestPhone: "+971500000000",
    startsAt: START,
    endsAt: dubai("2026-09-14T12:00:00"),
    arrivedAt: null,
    checkedInAt: null,
    checkedOutAt: null,
    adults: 2,
    children: 0,
    totalFils: 66_000,
    isComplimentary: false,
    customerId: "c0000000-0000-4000-8000-000000000001",
    guests: [],
    addons: [],
    acceptance: [],
    cleaningBufferMinutes: 20,
    personalRequest: null,
    internalNote: null,
    lateArrivalMinutes: null,
    overrunMinutes: null,
    overrunFils: null,
    subtotalFils: 66_000,
    discountFils: 0,
    addonsFils: 0,
    serviceFeeFils: 0,
    taxFils: 3_143,
    createdAt: dubai("2026-09-13T09:00:00"),
    isBlocked: false,
    warningNote: null,
    ...over,
  };
}

describe("§9.2 — a late arrival is offered only where there is a late arrival to record", () => {
  it("offers nothing while the guest has not arrived at all", () => {
    expect(canRecordLateArrival(booking())).toBe(false);
  });

  it("offers nothing when the guest arrived on time", () => {
    expect(
      canRecordLateArrival(booking({ arrivedAt: dubai("2026-09-14T09:58:00") })),
    ).toBe(false);
  });

  it("offers nothing when the guest arrived on the minute", () => {
    expect(canRecordLateArrival(booking({ arrivedAt: START }))).toBe(false);
  });

  it("offers it the moment a whole minute of lateness has elapsed", () => {
    expect(
      canRecordLateArrival(booking({ arrivedAt: dubai("2026-09-14T10:01:00") })),
    ).toBe(true);
  });

  it("does not offer it for a part minute, because the derived value would be zero", () => {
    const arrivedAt = dubai("2026-09-14T10:00:45");

    expect(lateArrivalMinutes(new Date(START), new Date(arrivedAt))).toBe(0);
    expect(canRecordLateArrival(booking({ arrivedAt }))).toBe(false);
  });

  it("keeps offering it once a value has been recorded, even for an on-time arrival", () => {
    expect(
      canRecordLateArrival(
        booking({ arrivedAt: dubai("2026-09-14T09:50:00"), lateArrivalMinutes: 0 }),
      ),
    ).toBe(true);
  });
});

describe("§9.2 — the derived minutes come from the arrival, never from the clock", () => {
  it("derives the same whole minutes the domain function does", () => {
    const arrivedAt = dubai("2026-09-14T10:17:45");

    expect(lateArrivalMinutes(new Date(START), new Date(arrivedAt))).toBe(17);
    expect(canRecordLateArrival(booking({ arrivedAt }))).toBe(true);
  });
});

describe("§9.2 — lateness belongs to a stay that happened or is happening", () => {
  const RECORDABLE: readonly BookingStatus[] = ["confirmed", "checked_in", "completed"];
  const REFUSED: readonly BookingStatus[] = BOOKING_STATUSES.filter(
    (status) => !RECORDABLE.includes(status),
  );

  it("accounts for every booking status the database knows", () => {
    expect(RECORDABLE.length + REFUSED.length).toBe(BOOKING_STATUSES.length);
  });

  for (const status of RECORDABLE) {
    it(`offers it on a ${status.replaceAll("_", " ")} booking`, () => {
      expect(
        canRecordLateArrival(
          booking({ status, arrivedAt: dubai("2026-09-14T10:20:00") }),
        ),
      ).toBe(true);
    });
  }

  for (const status of REFUSED) {
    it(`refuses it on a ${status.replaceAll("_", " ")} booking`, () => {
      expect(
        canRecordLateArrival(
          booking({ status, arrivedAt: dubai("2026-09-14T10:20:00") }),
        ),
      ).toBe(false);
    });
  }
});
