import { describe, expect, it } from "vitest";

import {
  bookableStarts,
  dubaiOffsetMinutes,
  dubaiWallTimeToInstant,
  type OpeningWindow,
} from "@/lib/domain/schedule";

import { TIME_ZONES, withTimeZone } from "../support/time";

const SEPT_1_2026 = { day: 1, month: 9, year: 2026 } as const;

describe("dubaiOffsetMinutes — §13 'everything in Dubai time'", () => {
  it("is +4 hours, and stays +4 in midsummer and midwinter", () => {
    expect(dubaiOffsetMinutes(new Date("2026-01-15T00:00:00Z"))).toBe(240);
    expect(dubaiOffsetMinutes(new Date("2026-07-15T00:00:00Z"))).toBe(240);
  });

  it("does not depend on the machine's own time zone", () => {
    for (const zone of TIME_ZONES) {
      withTimeZone(zone, () => {
        expect(dubaiOffsetMinutes(new Date("2026-09-01T00:00:00Z"))).toBe(240);
      });
    }
  });
});

describe("dubaiWallTimeToInstant", () => {
  it("turns 10:00 in Dubai into 06:00 UTC", () => {
    expect(dubaiWallTimeToInstant(SEPT_1_2026, "10:00")).toEqual(
      new Date("2026-09-01T06:00:00.000Z"),
    );
  });

  it("handles midnight and the end of the day", () => {
    expect(dubaiWallTimeToInstant(SEPT_1_2026, "00:00")).toEqual(
      new Date("2026-08-31T20:00:00.000Z"),
    );
    expect(dubaiWallTimeToInstant(SEPT_1_2026, "23:45")).toEqual(
      new Date("2026-09-01T19:45:00.000Z"),
    );
  });

  it("gives the same answer whatever the machine's zone", () => {
    for (const zone of TIME_ZONES) {
      withTimeZone(zone, () => {
        expect(dubaiWallTimeToInstant(SEPT_1_2026, "10:00")).toEqual(
          new Date("2026-09-01T06:00:00.000Z"),
        );
      });
    }
  });
});

describe("bookableStarts — §7.1 grid inside §10.2 opening hours", () => {
  const tenToTen: OpeningWindow[] = [{ opens: "10:00", closes: "22:00" }];

  it("offers the whole grid from opening, and stops so the experience ends by closing", () => {
    const starts = bookableStarts({
      date: SEPT_1_2026,
      windows: tenToTen,
      intervalMinutes: 15,
      durationHours: 2,
    });

    expect(starts[0]).toEqual(dubaiWallTimeToInstant(SEPT_1_2026, "10:00"));

    expect(starts.at(-1)).toEqual(dubaiWallTimeToInstant(SEPT_1_2026, "20:00"));
    expect(starts).not.toContainEqual(dubaiWallTimeToInstant(SEPT_1_2026, "20:15"));
  });

  it("shortens the day as the duration grows", () => {
    const last = (durationHours: number) =>
      bookableStarts({ date: SEPT_1_2026, windows: tenToTen, intervalMinutes: 15, durationHours }).at(-1);

    expect(last(2)).toEqual(dubaiWallTimeToInstant(SEPT_1_2026, "20:00"));
    expect(last(6)).toEqual(dubaiWallTimeToInstant(SEPT_1_2026, "16:00"));
  });

  it("returns nothing when the day is shorter than the experience", () => {
    expect(
      bookableStarts({
        date: SEPT_1_2026,
        windows: [{ opens: "10:00", closes: "13:00" }],
        intervalMinutes: 15,
        durationHours: 6,
      }),
    ).toEqual([]);
  });

  it("returns nothing when the venue is closed that day", () => {
    expect(
      bookableStarts({ date: SEPT_1_2026, windows: [], intervalMinutes: 15, durationHours: 2 }),
    ).toEqual([]);
  });

  it("supports a split day without offering the gap", () => {
    const starts = bookableStarts({
      date: SEPT_1_2026,
      windows: [
        { opens: "09:00", closes: "13:00" },
        { opens: "17:00", closes: "23:00" },
      ],
      intervalMinutes: 60,
      durationHours: 2,
    });

    expect(starts).toContainEqual(dubaiWallTimeToInstant(SEPT_1_2026, "11:00"));
    expect(starts).not.toContainEqual(dubaiWallTimeToInstant(SEPT_1_2026, "13:00"));
    expect(starts).not.toContainEqual(dubaiWallTimeToInstant(SEPT_1_2026, "15:00"));
    expect(starts).toContainEqual(dubaiWallTimeToInstant(SEPT_1_2026, "17:00"));
  });

  it("stays on clock times when Management retunes the interval [§10.2]", () => {
    const starts = bookableStarts({
      date: SEPT_1_2026,
      windows: tenToTen,
      intervalMinutes: 30,
      durationHours: 2,
    });

    expect(starts.slice(0, 3)).toEqual([
      dubaiWallTimeToInstant(SEPT_1_2026, "10:00"),
      dubaiWallTimeToInstant(SEPT_1_2026, "10:30"),
      dubaiWallTimeToInstant(SEPT_1_2026, "11:00"),
    ]);
  });

  it("is strictly increasing and free of duplicates across windows", () => {
    const starts = bookableStarts({
      date: SEPT_1_2026,
      windows: [
        { opens: "09:00", closes: "12:00" },
        { opens: "11:00", closes: "14:00" },
      ],
      intervalMinutes: 15,
      durationHours: 2,
    });

    const times = starts.map((d) => d.getTime());
    expect(times).toEqual([...new Set(times)]);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe("bookableStarts — next grid start [CLIENT], horizon and cut-off [§10.2]", () => {
  const tenToTen: OpeningWindow[] = [{ opens: "10:00", closes: "22:00" }];
  const now = dubaiWallTimeToInstant(SEPT_1_2026, "12:20");

  it("offers the next grid start, never a past time [§2, CLIENT]", () => {
    const starts = bookableStarts({
      date: SEPT_1_2026,
      windows: tenToTen,
      intervalMinutes: 15,
      durationHours: 2,
      now,
    });
    expect(starts[0]).toEqual(dubaiWallTimeToInstant(SEPT_1_2026, "12:30"));
  });

  it.each([
    ["12:20", "12:30"],
    ["12:30", "12:30"],
    ["12:31", "13:00"],
  ])("offers a 30-minute grid at %s from %s without adding a notice period [CLIENT]", (clock, expected) => {
    const starts = bookableStarts({
      date: SEPT_1_2026,
      windows: tenToTen,
      intervalMinutes: 30,
      durationHours: 2,
      now: dubaiWallTimeToInstant(SEPT_1_2026, clock),
    });
    expect(starts[0]).toEqual(dubaiWallTimeToInstant(SEPT_1_2026, expected));
  });

  it("drops the whole day past the maximum horizon", () => {
    const farOff = { day: 30, month: 11, year: 2026 } as const;
    expect(
      bookableStarts({
        date: farOff,
        windows: tenToTen,
        intervalMinutes: 15,
        durationHours: 2,
        now,
        maxHorizonDays: 30,
      }),
    ).toEqual([]);
  });

  it("closes today after the same-day cut-off but leaves tomorrow alone", () => {
    const today = bookableStarts({
      date: SEPT_1_2026,
      windows: tenToTen,
      intervalMinutes: 15,
      durationHours: 2,
      now,
      sameDayCutoff: "12:00",
    });
    expect(today).toEqual([]);

    const tomorrow = bookableStarts({
      date: { day: 2, month: 9, year: 2026 },
      windows: tenToTen,
      intervalMinutes: 15,
      durationHours: 2,
      now,
      sameDayCutoff: "12:00",
    });
    expect(tomorrow.length).toBeGreaterThan(0);
  });
});
