import { describe, expect, it } from "vitest";

import {
  STAFF_STATUSES,
  canSaveStatus,
  filterSuites,
  formatDubaiDay,
  formatDubaiMoment,
  holdsSuite,
  initialStatusChoice,
  isFiltered,
  listParams,
  liveState,
  nextSuiteNumber,
  nowLabel,
  parseSuitesQuery,
  staffState,
  suiteDrawerHref,
  suiteGroup,
  suiteName,
  suiteStatusLine,
  suitePath,
  suitesHref,
  summariseSuites,
} from "@/app/(console)/manage/suites/suites-view";
import { NEVER_AUTO_ALLOCATED } from "@/lib/config/suite-status";
import type { ManagedSuite } from "@/lib/db/queries/suite-inventory";

function suite(overrides: Partial<ManagedSuite> & Pick<ManagedSuite, "id" | "suiteNumber">): ManagedSuite {
  return {
    displayName: null,
    status: "available",
    priority: 1,
    internalNote: null,
    bookingsToday: 0,
    holdsToday: 0,
    nextBookingAt: null,
    currentState: null,
    isActive: true,
    retiredAt: null,
    retirementReason: null,
    retiredByName: null,
    hasHistory: false,
    upcomingBookings: 0,
    ...overrides,
  };
}

const SUITES: ManagedSuite[] = [
  suite({ id: "a", suiteNumber: 1, displayName: "Cedar" }),
  suite({ id: "b", suiteNumber: 2, currentState: "booked" }),
  suite({ id: "c", suiteNumber: 3, status: "not_ready" }),
  suite({ id: "d", suiteNumber: 4, currentState: "block" }),
  suite({ id: "e", suiteNumber: 12, currentState: "cleaning", displayName: "Suite 12" }),
  suite({
    id: "f",
    suiteNumber: 7,
    isActive: false,
    status: "out_of_service",
    retiredAt: "2026-09-01T08:00:00Z",
    hasHistory: true,
  }),
];

describe("a suite's live state comes from what is happening now, not only the stored status", () => {
  it("shows the occupancy on the board ahead of the stored status", () => {
    expect(liveState(suite({ id: "x", suiteNumber: 1, currentState: "hold" }))).toBe("checkout_hold");
    expect(liveState(suite({ id: "x", suiteNumber: 1, currentState: "checked_in" }))).toBe("checked_in");
    expect(liveState(suite({ id: "x", suiteNumber: 1, currentState: "maintenance" }))).toBe("maintenance");
    expect(liveState(suite({ id: "x", suiteNumber: 1, currentState: "block", status: "available" }))).toBe("blocked");
  });

  it("falls back to the stored status when nothing on the board explains the suite", () => {
    expect(liveState(suite({ id: "x", suiteNumber: 1, status: "not_ready" }))).toBe("not_ready");
    expect(liveState(suite({ id: "x", suiteNumber: 1, currentState: "completed", status: "available" }))).toBe("available");
    expect(liveState(suite({ id: "x", suiteNumber: 1, currentState: "no_show", status: "maintenance" }))).toBe("maintenance");
  });

  it("treats a retired or inactive suite as retired whatever its status says", () => {
    expect(liveState(SUITES[5])).toBe("retired");
    expect(liveState(suite({ id: "x", suiteNumber: 1, isActive: false }))).toBe("retired");
    expect(liveState(suite({ id: "x", suiteNumber: 1, retiredAt: "2026-09-01T08:00:00Z", currentState: "booked" }))).toBe("retired");
  });

  it("groups states the way the summary cards count them", () => {
    expect(suiteGroup("available")).toBe("available");
    for (const state of ["checkout_hold", "booked", "checked_in", "cleaning"] as const) {
      expect(suiteGroup(state)).toBe("in_use");
    }
    for (const state of NEVER_AUTO_ALLOCATED) expect(suiteGroup(state)).toBe("held");
    expect(suiteGroup("retired")).toBeNull();
  });
});

describe("the suites list reads its filters from the address", () => {
  it("shows every suite in service by default", () => {
    const query = parseSuitesQuery({});
    expect(query).toEqual({ search: "", group: null, retired: "hide" });
    expect(isFiltered(query)).toBe(false);
    expect(filterSuites(SUITES, query).map((row) => row.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("ignores values it does not recognise and trims the search", () => {
    const query = parseSuitesQuery({ status: "lost", retired: "maybe", q: ["one", "two"] });
    expect(query).toEqual({ search: "", group: null, retired: "hide" });
    expect(parseSuitesQuery({ q: "  cedar " }).search).toBe("cedar");
    expect(parseSuitesQuery({ q: "x".repeat(500) }).search.length).toBeLessThan(500);
  });

  it("filters by what the suite is doing now", () => {
    const by = (status: string) => filterSuites(SUITES, parseSuitesQuery({ status })).map((row) => row.id);
    expect(by("available")).toEqual(["a"]);
    expect(by("in_use")).toEqual(["b", "e"]);
    expect(by("held")).toEqual(["c", "d"]);
  });

  it("hides retired suites unless asked, and can show them alone", () => {
    expect(filterSuites(SUITES, parseSuitesQuery({ retired: "show" })).map((row) => row.id)).toEqual([
      "a", "b", "c", "d", "e", "f",
    ]);
    expect(filterSuites(SUITES, parseSuitesQuery({ retired: "only" })).map((row) => row.id)).toEqual(["f"]);
    expect(isFiltered(parseSuitesQuery({ retired: "only" }))).toBe(true);
  });

  it("searches by suite number and by name", () => {
    const search = (q: string) => filterSuites(SUITES, parseSuitesQuery({ q })).map((row) => row.id);
    expect(search("cedar")).toEqual(["a"]);
    expect(search("suite 1")).toEqual(["a", "e"]);
    expect(search("12")).toEqual(["e"]);
    expect(search("nothing here")).toEqual([]);
  });

  it("counts active, free, in-use, staff-held and retired suites", () => {
    expect(summariseSuites(SUITES)).toEqual({ active: 5, available: 1, inUse: 2, held: 2, retired: 1 });
    expect(summariseSuites([])).toEqual({ active: 0, available: 0, inUse: 0, held: 0, retired: 0 });
  });

  it("keeps the other filters when a link changes one and drops a page", () => {
    expect(suitesHref({ q: "cedar", page: "3" }, { status: "held" })).toBe(
      "/manage/suites?q=cedar&page=3&status=held",
    );
    expect(suitesHref({ status: "held" }, { status: null })).toBe("/manage/suites");
  });
});

describe("a suite opens in a drawer over the list, addressed by the list's own URL", () => {
  it("links to a suite through the list with the suite in the query", () => {
    expect(suitePath("abc")).toBe("/manage/suites?suite=abc");
  });

  it("keeps the list filters and starts a newly opened suite on its first tab and this month", () => {
    expect(suiteDrawerHref("q=cedar&status=held&tab=pricing&rates=2026-11&suite=old", "new")).toBe(
      "/manage/suites?q=cedar&status=held&suite=new",
    );
  });

  it("closes back to exactly the filtered list", () => {
    expect(suiteDrawerHref("q=cedar&suite=abc&tab=bookings&booked=2026-12", null)).toBe("/manage/suites?q=cedar");
    expect(suiteDrawerHref("suite=abc", null)).toBe("/manage/suites");
  });

  it("never carries an open suite into the list's own filter links", () => {
    expect(listParams({ q: "cedar", suite: "abc", tab: "pricing", booked: "2026-12", rates: "2027-01" })).toEqual({
      q: "cedar",
    });
    expect(suitesHref(listParams({ status: "held", suite: "abc" }), { status: null })).toBe("/manage/suites");
  });
});

describe("[CLIENT] a suite shows one status: the one Change status edits", () => {
  it("shows the staff status rather than what is happening now", () => {
    expect(staffState(suite({ id: "x", suiteNumber: 1, status: "available", currentState: "checked_in" }))).toBe(
      "available",
    );
    expect(staffState(suite({ id: "x", suiteNumber: 1, status: "maintenance" }))).toBe("maintenance");
  });

  it("shows Retired for a retired suite whatever its stored status", () => {
    expect(staffState(SUITES[5])).toBe("retired");
  });

  it("describes what is happening now in plain words", () => {
    expect(nowLabel("available")).toBe("Free");
    expect(nowLabel("checked_in")).toBe("Checked in");
    expect(nowLabel("blocked")).toBe("Blocked");
    expect(nowLabel("retired")).toBe("Not taking bookings");
  });
});

describe("suite names and numbers", () => {
  it("shows a name only when it says more than the number", () => {
    expect(suiteName(SUITES[0])).toBe("Cedar");
    expect(suiteName(SUITES[4])).toBeNull();
    expect(suiteName(suite({ id: "x", suiteNumber: 5, displayName: "   " }))).toBeNull();
  });

  it("suggests the number after the highest one in use, retired suites included", () => {
    expect(nextSuiteNumber(SUITES)).toBe(13);
    expect(nextSuiteNumber([])).toBe(1);
  });
});

describe("dates on the suites screens read in Dubai time", () => {
  const now = new Date("2026-10-14T06:00:00Z");

  it("names today and tomorrow in Dubai, not in the server's zone", () => {
    expect(formatDubaiMoment("2026-10-14T19:30:00Z", now)).toBe("Today, 23:30");
    expect(formatDubaiMoment("2026-10-14T20:30:00Z", now)).toBe("Tomorrow, 00:30");
    expect(formatDubaiMoment("2026-10-14T10:00:00Z", now)).toBe("Today, 14:00");
    expect(formatDubaiMoment("2026-10-13T21:00:00Z", now)).toBe("Today, 01:00");
  });

  it("gives a weekday and date later in the year, and adds the year beyond it", () => {
    expect(formatDubaiMoment("2026-10-17T06:00:00Z", now)).toBe("Sat 17 Oct, 10:00");
    expect(formatDubaiMoment("2027-01-02T06:00:00Z", now)).toBe("Sat 2 Jan 2027, 10:00");
    expect(formatDubaiDay("2026-10-17T21:00:00Z")).toBe("Sun 18 Oct 2026");
  });

  it("returns nothing for a value that is not a date", () => {
    expect(formatDubaiMoment("not a date", now)).toBe("");
    expect(formatDubaiDay("not a date")).toBe("");
  });
});

describe("[CLIENT] Management changes a suite's staff status, never its occupancy", () => {
  it("offers Available and exactly the statuses that hold a suite back", () => {
    expect(STAFF_STATUSES[0]).toBe("available");
    expect([...STAFF_STATUSES].sort()).toEqual(["available", ...NEVER_AUTO_ALLOCATED].sort());
    for (const status of ["checkout_hold", "booked", "checked_in", "cleaning"] as const) {
      expect(STAFF_STATUSES).not.toContain(status);
    }
  });

  it("asks for a reason only for the statuses that hold a suite back", () => {
    for (const status of NEVER_AUTO_ALLOCATED) expect(holdsSuite(status)).toBe(true);
    expect(holdsSuite("available")).toBe(false);
  });

  it("starts from the stored status, not the live one, and lets any other choice be saved", () => {
    expect(initialStatusChoice("available")).toBe("available");
    expect(initialStatusChoice("not_ready")).toBe("not_ready");
    expect(canSaveStatus("available", "available")).toBe(false);
    expect(canSaveStatus("maintenance", "available")).toBe(true);
    expect(canSaveStatus("available", "blocked")).toBe(true);
  });

  it("starts with no choice when the stored status is one staff cannot set", () => {
    expect(initialStatusChoice("cleaning")).toBeNull();
    expect(canSaveStatus(null, "cleaning")).toBe(false);
    expect(canSaveStatus("available", "cleaning")).toBe(true);
  });
});

describe("[Project owner's direction 2026-09-12] a suite card says its state once, in words", () => {
  const now = new Date("2026-09-16T06:00:00Z");

  it("tells a free suite when its next guest arrives", () => {
    expect(
      suiteStatusLine(suite({ id: "a", suiteNumber: 1, nextBookingAt: "2026-09-16T14:00:00Z" }), now),
    ).toBe("Free until Today, 18:00");
  });

  it("says a free suite has nothing booked rather than leaving it blank", () => {
    expect(suiteStatusLine(suite({ id: "a", suiteNumber: 1 }), now)).toBe("Free, nothing booked");
  });

  it("gives a busy suite the next fact instead of repeating its chip", () => {
    const busy = suite({ id: "a", suiteNumber: 1, currentState: "cleaning", nextBookingAt: "2026-09-17T06:00:00Z" });
    expect(suiteStatusLine(busy, now)).toBe("Next booking Tomorrow, 10:00");
    expect(suiteStatusLine(suite({ id: "a", suiteNumber: 1, currentState: "cleaning" }), now)).toBe("Nothing booked next");
  });

  it("says a retired suite takes no bookings at all", () => {
    expect(
      suiteStatusLine(suite({ id: "a", suiteNumber: 1, isActive: false, retiredAt: "2026-09-01T06:00:00Z" }), now),
    ).toBe("Not taking bookings");
  });
});
