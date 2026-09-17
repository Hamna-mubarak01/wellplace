import { guestBookingRefusal } from "@/lib/services/guest-booking-rules";
import { describe, expect, it, vi } from "vitest";
import { snapshotFromRows } from "@/lib/config";
import { closuresSchema, openingExceptionsSchema, seasonalHoursSchema, weeklyHoursSchema, EMPTY_WEEK, LAUNCH_WEEK } from "@/lib/config/opening-hours";
import type { WellPlaceClient } from "@/lib/db/types";
import { getAvailabilityWindow, getDayAvailability } from "@/lib/services/availability-service";
import { openingHoursRefusal, publicOpeningHours, windowsForDate } from "@/lib/services/opening-hours-service";
import { priceGuestBooking } from "@/app/(site)/book/quote";
import { dayWindow } from "@/lib/services/board-service";

const regular = { ...EMPTY_WEEK, tue: [{ opens: "10:00", closes: "22:00" }] };
const seasonal = { periods: [{ from: "2026-09-01", to: "2026-09-15", hours: { ...EMPTY_WEEK, tue: [{ opens: "12:00", closes: "18:00" }] } }] };
const exceptions = [{ date: "2026-09-08", windows: [{ opens: "14:00", closes: "17:00" }] }];
const date = { year: 2026, month: 9, day: 8 };
const now = new Date("2026-09-01T00:00:00Z");
function snapshot(extra: Record<string, unknown> = {}) {
  return snapshotFromRows(Object.entries({ "hours.regular": regular, "hours.seasonal": seasonal, ...extra }).map(([key, value]) => ({ key, value })));
}
function database() {
  const rpc = vi.fn(async (_name: string, args: { p_starts_at: string[] }) => ({
    data: args.p_starts_at.map((starts_at) => ({ starts_at, remaining: 7, reduced_by_demand: false })), error: null,
  }));
  return { client: { rpc } as unknown as WellPlaceClient, rpc };
}

describe("[§10.2] hours validation before publication", () => {
  it("rejects invalid times, equal endpoints and overlapping windows", () => {
    for (const tue of [
      [{ opens: "25:00", closes: "26:00" }],
      [{ opens: "22:00", closes: "22:00" }],
      [{ opens: "10:00", closes: "14:00" }, { opens: "13:00", closes: "17:00" }],
    ]) expect(weeklyHoursSchema.safeParse({ ...regular, tue }).success).toBe(false);
    expect(weeklyHoursSchema.safeParse({ ...regular, tue: [{ opens: "10:03", closes: "14:00" }, { opens: "14:00", closes: "17:00" }] }).success).toBe(true);
  });
  it("requires real dates and an unambiguous season or exception", () => {
    expect(closuresSchema.safeParse([{ from: "2026-02-30", to: "2026-03-01" }]).success).toBe(false);
    expect(closuresSchema.safeParse([{ from: "2026-09-09", to: "2026-09-08" }]).success).toBe(false);
    expect(seasonalHoursSchema.safeParse({ periods: [...seasonal.periods, { ...seasonal.periods[0], from: "2026-09-15" }] }).success).toBe(false);
    expect(openingExceptionsSchema.safeParse([...exceptions, ...exceptions]).success).toBe(false);
    expect(openingExceptionsSchema.safeParse([{ ...exceptions[0], privateNote: "not public" }]).success).toBe(false);
    expect(seasonalHoursSchema.parse({})).toEqual({ periods: [] });
  });
});

describe("[§10.2, OUR CHOICE] effective hours", () => {
  it("applies seasonal dates inclusively and restores regular hours afterwards", () => {
    for (const day of [1, 8, 15]) expect(windowsForDate(snapshot(), { ...date, day })).toEqual(seasonal.periods[0].hours.tue);
    expect(windowsForDate(snapshot(), { ...date, day: 22 })).toEqual(regular.tue);
  });
  it("lets one-off hours override a season, including closing that date", () => {
    expect(windowsForDate(snapshot({ "hours.exceptions": exceptions }), date)).toEqual(exceptions[0].windows);
    expect(windowsForDate(snapshot({ "hours.exceptions": [{ ...exceptions[0], windows: [] }] }), date)).toEqual([]);
  });
  it("lets a full closure win over every opening, including both boundary dates", () => {
    const hours = snapshot({ "hours.exceptions": exceptions, "hours.closures": [{ from: "2026-09-08", to: "2026-09-15" }] });
    for (const day of [8, 15]) expect(windowsForDate(hours, { ...date, day })).toEqual([]);
  });
  it("opens a one-off date without a regular week and distinguishes missing hours", () => {
    expect(windowsForDate(snapshotFromRows([]), date)).toEqual(LAUNCH_WEEK.tue);
    expect(windowsForDate(snapshotFromRows([{ key: "hours.exceptions", value: exceptions }]), date)).toEqual(exceptions[0].windows);
    expect(() => windowsForDate(snapshot({ "hours.closures": [{ start: "2026-09-08" }] }), date)).toThrow("Opening hours need review");
  });
  it("rechecks a submitted stay against the latest hours, including breaks and closing time", () => {
    const hours = snapshot({ "hours.exceptions": [{ date: "2026-09-08", windows: [{ opens: "10:00", closes: "12:00" }, { opens: "14:00", closes: "18:00" }] }] });
    expect(openingHoursRefusal(hours, "2026-09-08T06:00:00Z", 120)).toBeNull();
    expect(openingHoursRefusal(hours, "2026-09-08T07:00:00Z", 120)).toMatch("10:00\u201312:00, 14:00\u201318:00");
    expect(openingHoursRefusal(hours, "2026-09-08T12:00:00Z", 121)).toMatch("10:00\u201312:00, 14:00\u201318:00");
    expect(openingHoursRefusal(snapshot({ "hours.closures": [{ from: "2026-09-08", to: "2026-09-08" }] }), "2026-09-08T10:00:00Z", 120)).toMatch("closed all day");
  });
  it("publishes the effective Dubai date across UTC midnight and omits expired changes", () => {
    const published = publicOpeningHours(snapshot({ "hours.exceptions": exceptions, "hours.closures": [{ from: "2026-08-01", to: "2026-08-02" }] }), new Date("2026-09-07T20:30:00Z"));
    expect(published.days[0]).toEqual({ date: "2026-09-08", label: "Today", windows: exceptions[0].windows });
    expect(published.special.map((entry) => entry.kind)).toEqual(["Seasonal hours", "One-off hours"]);
  });
});

describe("[CLIENT] saved hours reach both booking availability paths", () => {
  it("accepts named seasonal schedules on Front desk and the guest calendar, even before the season starts", async () => {
    const hours = snapshot({ "hours.seasonal": {
      periods: [{ ...seasonal.periods[0], name: "Eid timings" }],
    } });
    expect(seasonalHoursSchema.parse(hours["hours.seasonal"]).periods[0].name).toBe("Eid timings");
    expect(dayWindow(hours, date).window).toEqual({ start: "2026-09-08T08:00:00.000Z", end: "2026-09-08T14:00:00.000Z" });
    expect(dayWindow(hours, { year: 2026, month: 8, day: 25 }).status).toBe("open");
    const { client } = database();
    const day = await getDayAvailability(client, hours, { date, durationHours: 2, now });
    const window = await getAvailabilityWindow(client, hours, { dates: [date], durationsHours: [2], now });
    expect(window.ok && window.days[0].slotsByDuration[2]).toEqual(day.slots);
    expect(openingHoursRefusal(hours, "2026-09-08T08:00:00Z", 120)).toBeNull();
    expect(() => windowsForDate(snapshot({ "hours.seasonal": {
      periods: [{ ...seasonal.periods[0], name: "Eid timings", unexpected: true }],
    } }), date)).toThrow("Opening hours need review");
  });
  it("offers the next 30-minute grid start in both paths despite a retired notice value [CLIENT]", async () => {
    const { client } = database();
    const hours = {
      ...snapshot({ "booking.start_interval_minutes": 30 }),
      "booking.min_notice_minutes": 90,
    };
    const currentTime = new Date("2026-09-08T08:20:00Z");
    const day = await getDayAvailability(client, hours, { date, durationHours: 2, now: currentTime });
    const window = await getAvailabilityWindow(client, hours, { dates: [date], durationsHours: [2], now: currentTime });
    expect(day.slots[0]?.label).toBe("12:30");
    expect(window.ok && window.days[0].slotsByDuration[2]).toEqual(day.slots);
  });
  it("refuses a stale guest selection when a closure was saved before quoting", async () => {
    const { client, rpc } = database();
    const result = await priceGuestBooking(client, snapshot({ "hours.closures": [{ from: "2026-09-08", to: "2026-09-08" }] }), {
      startsAt: "2026-09-08T10:00:00Z", durationHours: 2, adults: 2,
      childAges: [], addonQuantities: {}, comparisonDurationsHours: [],
    });
    expect(result).toEqual({ status: "unpriced", message: "WellPlace is closed all day on this date. Choose another day, or add opening hours in Management." });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("only offers stays entirely inside the effective window", async () => {
    const { client } = database();
    const hours = snapshot({ "hours.exceptions": exceptions });
    const day = await getDayAvailability(client, hours, { date, durationHours: 2, now });
    const window = await getAvailabilityWindow(client, hours, { dates: [date], durationsHours: [2], now });
    expect(day.status).toBe("open");
    expect(day.slots.map((slot) => slot.label)).toEqual(["14:00", "14:15", "14:30", "14:45", "15:00"]);
    expect(window.ok && window.days[0].slotsByDuration[2]).toEqual(day.slots);
  });
  it("returns no slots after a closure is saved and restores them after clearing", async () => {
    const { client, rpc } = database();
    const closed = snapshot({ "hours.closures": [{ from: "2026-09-08", to: "2026-09-08" }] });
    expect((await getDayAvailability(client, closed, { date, durationHours: 2, now })).status).toBe("closed");
    const window = await getAvailabilityWindow(client, closed, { dates: [date], durationsHours: [2], now });
    expect(window.ok && window.days[0].status).toBe("closed");
    expect(rpc).not.toHaveBeenCalled();
    expect((await getDayAvailability(client, snapshot(), { date, durationHours: 2, now })).slots.length).toBeGreaterThan(0);
  });
});

describe("[§Operational corrections] overnight launch hours", () => {
  const hours = snapshotFromRows([{ key: "hours.regular", value: LAUNCH_WEEK }]);
  it("offers a 01:00 next-day start ending at 03:00, with the actual date labelled", async () => {
    expect(weeklyHoursSchema.safeParse(LAUNCH_WEEK).success).toBe(true);
    const { client } = database();
    const result = await getDayAvailability(client, hours, { date, durationHours: 2, now });
    expect(result.slots.at(-1)).toMatchObject({ startsAt: "2026-09-08T21:00:00.000Z", label: "01:00 (+1 day)" });
    expect(openingHoursRefusal(hours, "2026-09-08T21:00:00Z", 120)).toBeNull();
    expect(guestBookingRefusal(hours, { startsAt: "2026-09-08T21:00:00Z", durationHours: 2, adults: 2, childAges: [] }, now)).toBeNull();
    expect(openingHoursRefusal(hours, "2026-09-08T21:00:00Z", 121)).not.toBeNull();
    expect(dayWindow(hours, date).window).toEqual({ start: "2026-09-08T04:00:00.000Z", end: "2026-09-08T23:00:00.000Z" });
  });
  it("a full closure blocks spillover from the previous evening", async () => {
    const closed = snapshotFromRows([{ key: "hours.regular", value: LAUNCH_WEEK }, { key: "hours.closures", value: [{ from: "2026-09-09", to: "2026-09-09" }] }]);
    expect(openingHoursRefusal(closed, "2026-09-08T21:00:00Z", 120)).not.toBeNull();
    const { client } = database();
    const result = await getDayAvailability(client, closed, { date, durationHours: 2, now });
    expect(result.slots.at(-1)?.label).toBe("22:00");
  });
});
