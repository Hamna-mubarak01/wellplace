import { describe, expect, it } from "vitest";

import {
  DEFAULT_SUITE_TAB,
  SUITE_BOOKING_STATUSES,
  isMonth,
  monthLabel,
  parseSuiteDrawerQuery,
  parseSuiteTab,
  shiftMonth,
  splitSuiteBookings,
  tabParam,
} from "@/app/(console)/manage/suites/suite-detail-view";

const TODAY = "2026-10-14";

describe("the suite drawer reads its state from the address", () => {
  it("stays closed without a suite and opens on this month", () => {
    expect(parseSuiteDrawerQuery({}, TODAY)).toEqual({
      suiteId: null,
      bookedMonth: "2026-10",
      rateMonth: "2026-10",
    });
  });

  it("keeps the open suite and each calendar's month separately", () => {
    const query = parseSuiteDrawerQuery({ suite: "abc", booked: "2026-12", rates: "2027-01" }, TODAY);
    expect(query).toEqual({ suiteId: "abc", bookedMonth: "2026-12", rateMonth: "2027-01" });
  });

  it("ignores values it does not recognise", () => {
    const query = parseSuiteDrawerQuery(
      { suite: ["a", "b"], booked: "2026-13", rates: ["2026-11", "2026-12"] },
      TODAY,
    );
    expect(query).toEqual({ suiteId: null, bookedMonth: "2026-10", rateMonth: "2026-10" });
    expect(parseSuiteDrawerQuery({ suite: "   " }, TODAY).suiteId).toBeNull();
    expect(isMonth("1999-12")).toBe(false);
    expect(isMonth("2026-1")).toBe(false);
    expect(isMonth("2026-01")).toBe(true);
  });

  it("opens on Overview and leaves the default tab out of the address", () => {
    expect(parseSuiteTab(null)).toBe(DEFAULT_SUITE_TAB);
    expect(parseSuiteTab("elsewhere")).toBe("overview");
    expect(parseSuiteTab("bookings")).toBe("bookings");
    expect(parseSuiteTab("pricing")).toBe("pricing");
    expect(tabParam("overview")).toBeNull();
    expect(tabParam("pricing")).toBe("pricing");
  });

  it("moves between months across the turn of the year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-10", 14)).toBe("2027-12");
    expect(monthLabel("2026-10")).toBe("October 2026");
  });
});

describe("a suite's bookings in the drawer, upcoming first", () => {
  const row = (id: string) => ({ id });

  it("shows upcoming bookings first and fills the rest with the latest earlier ones", () => {
    expect(splitSuiteBookings([row("u1"), row("u2")], [row("p1"), row("p2"), row("p3")], 4)).toEqual({
      upcoming: [row("u1"), row("u2")],
      earlier: [row("p1"), row("p2")],
    });
  });

  it("never lists a visit in progress twice", () => {
    expect(splitSuiteBookings([row("now"), row("u1")], [row("now"), row("p1")], 6)).toEqual({
      upcoming: [row("now"), row("u1")],
      earlier: [row("p1")],
    });
  });

  it("stops at the limit, even when every booking is upcoming", () => {
    expect(splitSuiteBookings([row("u1"), row("u2"), row("u3")], [row("p1")], 2)).toEqual({
      upcoming: [row("u1"), row("u2")],
      earlier: [],
    });
    expect(splitSuiteBookings([row("u1")], [row("p1")], 0)).toEqual({ upcoming: [], earlier: [] });
  });

  it("leaves out checkouts that never became bookings", () => {
    expect(SUITE_BOOKING_STATUSES).not.toContain("draft");
    expect(SUITE_BOOKING_STATUSES).not.toContain("abandoned");
    expect(SUITE_BOOKING_STATUSES).not.toContain("hold_expired");
    for (const status of ["confirmed", "checked_in", "completed", "cancelled", "no_show"] as const) {
      expect(SUITE_BOOKING_STATUSES).toContain(status);
    }
  });
});

