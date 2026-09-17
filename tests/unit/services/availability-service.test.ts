import { describe, expect, it, vi } from "vitest";

import { snapshotFromRows } from "@/lib/config";
import type { WellPlaceClient } from "@/lib/db/types";
import { getDayAvailability } from "@/lib/services/availability-service";


const OPEN_ALL_WEEK = Object.fromEntries(
  ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [
    day,
    [{ opens: "10:00", closes: "22:00" }],
  ]),
);

const DATE = { day: 1, month: 9, year: 2026 } as const;
const NOW = new Date("2026-08-25T06:00:00.000Z");

function snapshot(overrides: Record<string, unknown> = {}) {
  return snapshotFromRows(
    Object.entries({ "hours.regular": OPEN_ALL_WEEK, ...overrides }).map(([key, value]) => ({
      key,
      value,
    })),
  );
}

function clientReturning(
  rows: (startsAt: string, index: number) => { remaining: number; reduced_by_demand: boolean },
) {
  const rpc = vi.fn(async (_name: string, args: { p_starts_at: string[] }) => ({
    data: args.p_starts_at.map((startsAt, index) => ({
      starts_at: startsAt,
      ...rows(startsAt, index),
    })),
    error: null,
  }));
  return { client: { rpc } as unknown as WellPlaceClient, rpc };
}

describe("getDayAvailability — INV-01, guests never see capacity", () => {
  it("returns sentences and never a count, in any field", async () => {
    const { client } = clientReturning(() => ({ remaining: 3, reduced_by_demand: true }));

    const day = await getDayAvailability(client, snapshot(), {
      date: DATE,
      durationHours: 2,
      now: NOW,
    });

    expect(day.status).toBe("open");
    expect(day.slots.length).toBeGreaterThan(0);

    for (const slot of day.slots) {
      expect(slot.tile.message).toBe("Last availability for this time");
      expect(Object.keys(slot.tile).sort()).toEqual([
        "disabled",
        "kind",
        "message",
        "securedUntil",
      ]);
      expect(Object.keys(slot).sort()).toEqual(["label", "startsAt", "tile"]);
      expect(JSON.stringify(slot.tile)).not.toMatch(/[0-9]/);
    }
  });

  it("disables a fully-booked time and says so, rather than hiding it", async () => {
    const { client } = clientReturning((_s, index) =>
      index === 0 ? { remaining: 0, reduced_by_demand: true } : { remaining: 7, reduced_by_demand: false },
    );

    const day = await getDayAvailability(client, snapshot(), {
      date: DATE,
      durationHours: 2,
      now: NOW,
    });

    expect(day.slots[0].tile.disabled).toBe(true);
    expect(day.slots[0].tile.message).toBe("Fully booked");
    expect(day.slots[1].tile.disabled).toBe(false);
  });
});

describe("getDayAvailability — §7.4 the message follows the real cause", () => {
  it("[CLIENT] does not return the retired booking-up message", async () => {
    const demand = await getDayAvailability(
      clientReturning(() => ({ remaining: 6, reduced_by_demand: true })).client,
      snapshot(),
      { date: DATE, durationHours: 2, now: NOW },
    );
    expect(demand.slots[0].tile.message).toBeNull();

    const maintenance = await getDayAvailability(
      clientReturning(() => ({ remaining: 6, reduced_by_demand: false })).client,
      snapshot(),
      { date: DATE, durationHours: 2, now: NOW },
    );
    expect(maintenance.slots[0].tile.message).toBeNull();
  });

  it("shows a countdown instead of a message on the slot this guest holds [§7.3]", async () => {
    const { client } = clientReturning(() => ({ remaining: 0, reduced_by_demand: true }));
    const day = await getDayAvailability(client, snapshot(), {
      date: DATE,
      durationHours: 2,
      now: NOW,
    });
    const target = day.slots[0].startsAt;

    const held = await getDayAvailability(client, snapshot(), {
      date: DATE,
      durationHours: 2,
      now: NOW,
      securedStartsAt: target,
      securedUntil: new Date("2026-09-01T06:10:00.000Z"),
    });

    expect(held.slots[0].tile.kind).toBe("secured");
    expect(held.slots[0].tile.disabled).toBe(false);
    expect(held.slots[0].tile.message).toBeNull();
    expect(held.slots[1].tile.disabled).toBe(true);
  });
});

describe("getDayAvailability — the states §4.1 requires", () => {
  it("uses the client-confirmed launch hours when no override is stored", async () => {
    const { client, rpc } = clientReturning(() => ({ remaining: 7, reduced_by_demand: false }));

    const unconfigured = await getDayAvailability(
      client,
      snapshotFromRows([]),
      { date: DATE, durationHours: 2, now: NOW },
    );

    expect(unconfigured.status).toBe("open");
    expect(unconfigured.slots.length).toBeGreaterThan(0);
    expect(rpc).toHaveBeenCalled();
  });

  it("reports closed when the venue shuts that day", async () => {
    const { client } = clientReturning(() => ({ remaining: 7, reduced_by_demand: false }));
    const closedTuesday = { ...OPEN_ALL_WEEK, tue: [] };

    const day = await getDayAvailability(client, snapshot({ "hours.regular": closedTuesday }), {
      date: DATE,
      durationHours: 2,
      now: NOW,
    });

    expect(day.status).toBe("closed");
  });

  it("reports an error rather than an empty day when the lookup fails [R-33]", async () => {
    const failing = {
      rpc: async () => ({ data: null, error: { message: "connection reset" } }),
    } as unknown as WellPlaceClient;

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const day = await getDayAvailability(failing, snapshot(), {
      date: DATE,
      durationHours: 2,
      now: NOW,
    });

    expect(day.status).toBe("error");
    expect(day.slots).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("treats a start the database did not answer for as unavailable, never as free", async () => {
    const client = {
      rpc: async (_name: string, args: { p_starts_at: string[] }) => ({
        data: args.p_starts_at
          .slice(1)
          .map((startsAt) => ({ starts_at: startsAt, remaining: 7, reduced_by_demand: false })),
        error: null,
      }),
    } as unknown as WellPlaceClient;

    const day = await getDayAvailability(client, snapshot(), {
      date: DATE,
      durationHours: 2,
      now: NOW,
    });

    expect(day.slots[0].tile.disabled).toBe(true);
    expect(day.slots[1].tile.disabled).toBe(false);
  });
});

describe("getDayAvailability — §10.2 values are read, never assumed", () => {
  it("passes the configured buffer and duration to the database", async () => {
    const { client, rpc } = clientReturning(() => ({ remaining: 7, reduced_by_demand: false }));

    await getDayAvailability(client, snapshot({ "cleaning.buffer_minutes": 35 }), {
      date: DATE,
      durationHours: 5,
      now: NOW,
    });

    expect(rpc).toHaveBeenCalledWith(
      "count_available_suites",
      expect.objectContaining({ p_buffer_minutes: 35, p_duration_hours: 5 }),
    );
  });

  it("honours a retuned start interval", async () => {
    const { client, rpc } = clientReturning(() => ({ remaining: 7, reduced_by_demand: false }));

    await getDayAvailability(client, snapshot({ "booking.start_interval_minutes": 60 }), {
      date: DATE,
      durationHours: 2,
      now: NOW,
    });

    const sent = rpc.mock.calls[0][1] as { p_starts_at: string[] };
    expect(sent.p_starts_at).toHaveLength(11);
  });
});

it("[§7.6] checks exact rescheduling minutes through the booking-aware reader", async () => {
  const { client, rpc } = clientReturning(() => ({ remaining: 1, reduced_by_demand: false }));
  const bookingId = "7e2e0001-0000-4000-8000-000000000001";
  const day = await getDayAvailability(client, snapshot(), { date: DATE, durationHours: 2.5, rescheduleBookingId: bookingId, now: NOW });
  expect(day.status).toBe("open");
  expect(rpc).toHaveBeenCalledWith("count_reschedule_suites", expect.objectContaining({ p_booking_id: bookingId, p_duration_minutes: 150 }));
  expect(rpc).not.toHaveBeenCalledWith("count_available_suites", expect.anything());
});

it("[OUR CHOICE] splits a long opening day into database-sized availability reads", async () => {
  const { client, rpc } = clientReturning(() => ({ remaining: 1, reduced_by_demand: false }));
  const allDay = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [day, [{ opens: "00:00", closes: "23:59" }]]));
  const day = await getDayAvailability(client, snapshot({ "hours.regular": allDay, "booking.start_interval_minutes": 5 }), { date: DATE, durationHours: 2, now: NOW });
  expect(day.status).toBe("open");
  expect(day.slots.length).toBeGreaterThan(200);
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc.mock.calls.every(([, args]) => args.p_starts_at.length <= 200)).toBe(true);
  expect(day.slots.every((slot) => !slot.tile.disabled)).toBe(true);
});
