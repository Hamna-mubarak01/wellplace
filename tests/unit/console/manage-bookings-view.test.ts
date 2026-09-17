import { describe, expect, it } from "vitest";

import {
  BOOKINGS_PATH,
  bookingsHref,
  dubaiDayStart,
  exportHref,
  isFiltered,
  listRequest,
  matchesFilters,
  monthBounds,
  parseBookingsQuery,
  sortDirection,
  sourcesFor,
  statusesFor,
  summaryFilters,
  summaryRequest,
  visitWindow,
} from "@/app/(console)/manage/bookings/bookings-view";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";

const SUITE_A = "7e2e0001-0000-4000-8000-000000000001";
const SUITE_B = "7e2e0001-0000-4000-8000-000000000002";
const SUITES = [SUITE_A, SUITE_B];
const NOW = new Date("2026-09-11T10:00:00Z");

describe("[CLIENT console redesign brief] the Management bookings list reads its filters from the address", () => {
  it("defaults to every booking, newest visit first, on page one", () => {
    const query = parseBookingsQuery({}, SUITES);
    expect(query).toEqual({
      search: "",
      status: null,
      source: null,
      suiteId: null,
      from: null,
      to: null,
      period: "all",
      sort: "created",
      direction: null,
      page: 1,
    });
    expect(sortDirection(query)).toBe("desc");
    expect(isFiltered(query)).toBe(false);
  });

  it("accepts a known status, status group, source and suite, and ignores anything else", () => {
    expect(parseBookingsQuery({ status: "checked_in" }, SUITES).status).toBe("checked_in");
    expect(parseBookingsQuery({ status: "attention" }, SUITES).status).toBe("attention");
    expect(parseBookingsQuery({ status: "paid" }, SUITES).status).toBeNull();
    expect(parseBookingsQuery({ source: "walk_in" }, SUITES).source).toBe("walk_in");
    expect(parseBookingsQuery({ source: "phone" }, SUITES).source).toBeNull();
    expect(parseBookingsQuery({ suite: SUITE_B }, SUITES).suiteId).toBe(SUITE_B);
    expect(parseBookingsQuery({ suite: "7e2e0001-0000-4000-8000-000000000099" }, SUITES).suiteId).toBeNull();
  });

  it("[OUR CHOICE; project owner's direction, 14 September 2026] folds Website and Reception into the Booked via filter", () => {
    expect(parseBookingsQuery({ source: "reception" }, SUITES).source).toBe("reception");
    expect(parseBookingsQuery({ source: "bogus" }, SUITES).source).toBeNull();

    expect(sourcesFor(parseBookingsQuery({ source: "online" }, SUITES))).toEqual(["online"]);
    expect(sourcesFor(parseBookingsQuery({ source: "reception" }, SUITES))).toEqual([
      "walk_in",
      "telephone",
      "manual",
      "complimentary",
    ]);
    expect(sourcesFor(parseBookingsQuery({}, SUITES))).toBeUndefined();

    expect(isFiltered(parseBookingsQuery({ source: "reception" }, SUITES))).toBe(true);
    expect(isFiltered(parseBookingsQuery({ via: "website" }, SUITES))).toBe(false);
  });

  it("defaults to newest booked first, but keeps the visit sort inside a date window", () => {
    expect(parseBookingsQuery({}, SUITES).sort).toBe("created");
    expect(sortDirection(parseBookingsQuery({}, SUITES))).toBe("desc");

    expect(parseBookingsQuery({ period: "today" }, SUITES).sort).toBe("visit");
    expect(sortDirection(parseBookingsQuery({ period: "today" }, SUITES))).toBe("asc");
    expect(parseBookingsQuery({ period: "upcoming" }, SUITES).sort).toBe("visit");
    expect(sortDirection(parseBookingsQuery({ period: "upcoming" }, SUITES))).toBe("asc");
    expect(parseBookingsQuery({ period: "past" }, SUITES).sort).toBe("visit");
    expect(sortDirection(parseBookingsQuery({ period: "past" }, SUITES))).toBe("desc");
    expect(parseBookingsQuery({ from: "2026-10-01", to: "2026-10-07" }, SUITES).sort).toBe("visit");

    expect(sortDirection(parseBookingsQuery({ sort: "visit", dir: "asc" }, SUITES))).toBe("asc");
    expect(sortDirection(parseBookingsQuery({ sort: "created", dir: "asc" }, SUITES))).toBe("asc");
    expect(parseBookingsQuery({ sort: "created", dir: "asc" }, SUITES).sort).toBe("created");

    expect(parseBookingsQuery({ sort: "bogus" }, SUITES).sort).toBe("created");
    expect(parseBookingsQuery({ sort: "bogus", period: "today" }, SUITES).sort).toBe("visit");

    expect(isFiltered(parseBookingsQuery({ sort: "created", dir: "asc" }, SUITES))).toBe(false);
  });

  it("rejects impossible dates, swaps a reversed range and lets a range override the period", () => {
    expect(parseBookingsQuery({ from: "2026-02-30" }, SUITES).from).toBeNull();
    const reversed = parseBookingsQuery({ from: "2026-09-20", to: "2026-09-10", period: "today" }, SUITES);
    expect(reversed.from).toBe("2026-09-10");
    expect(reversed.to).toBe("2026-09-20");
    expect(reversed.period).toBe("all");
    expect(parseBookingsQuery({ to: "2026-09-10" }, SUITES).to).toBeNull();
  });

  it("clamps the search to the console limit and ignores a nonsense page", () => {
    const query = parseBookingsQuery({ q: `  ${"x".repeat(500)}  `, page: "-3" }, SUITES);
    expect(query.search.length).toBeLessThanOrEqual(100);
    expect(query.page).toBe(1);
    expect(parseBookingsQuery({ page: "4" }, SUITES).page).toBe(4);
  });

  it("sorts today's and upcoming visits soonest first unless the address asks otherwise", () => {
    expect(sortDirection(parseBookingsQuery({ period: "today" }, SUITES))).toBe("asc");
    expect(sortDirection(parseBookingsQuery({ period: "upcoming" }, SUITES))).toBe("asc");
    expect(sortDirection(parseBookingsQuery({ period: "past" }, SUITES))).toBe("desc");
    expect(sortDirection(parseBookingsQuery({ period: "upcoming", dir: "desc" }, SUITES))).toBe("desc");
  });
});

describe("[CLIENT console redesign brief] visit windows are Dubai days", () => {
  it("starts a Dubai day at 20:00 UTC the evening before", () => {
    expect(dubaiDayStart("2026-09-11")).toBe("2026-09-10T20:00:00.000Z");
  });

  it("maps each period onto an overlap window", () => {
    expect(visitWindow(parseBookingsQuery({ period: "today" }, SUITES), NOW)).toEqual({
      from: "2026-09-10T20:00:00.000Z",
      to: "2026-09-11T20:00:00.000Z",
    });
    expect(visitWindow(parseBookingsQuery({ period: "upcoming" }, SUITES), NOW)).toEqual({ from: NOW.toISOString() });
    expect(visitWindow(parseBookingsQuery({ period: "past" }, SUITES), NOW)).toEqual({ to: "2026-09-10T20:00:00.000Z" });
    expect(visitWindow(parseBookingsQuery({}, SUITES), NOW)).toEqual({});
  });

  it("includes the whole of the last day in a date range", () => {
    expect(visitWindow(parseBookingsQuery({ from: "2026-09-01", to: "2026-09-30" }, SUITES), NOW)).toEqual({
      from: "2026-08-31T20:00:00.000Z",
      to: "2026-09-30T20:00:00.000Z",
    });
  });
});

describe("[CLIENT console redesign brief] the list request filters and counts in the database", () => {
  it("expands status groups and passes every filter through", () => {
    expect(statusesFor("attention")).toEqual(["awaiting_payment", "payment_failed", "awaiting_recovery"]);
    expect(statusesFor("visits")).toEqual(["confirmed", "checked_in", "completed"]);
    expect(statusesFor("cancelled")).toEqual(["cancelled"]);
    expect(statusesFor(null)).toBeUndefined();

    const request = listRequest(
      parseBookingsQuery({ q: "WP-1", status: "attention", source: "online", suite: SUITE_A, page: "2" }, SUITES),
      NOW,
    );
    expect(request).toEqual({
      page: 2,
      pageSize: MANAGEMENT_LIST.pageSize,
      search: "WP-1",
      statuses: ["awaiting_payment", "payment_failed", "awaiting_recovery"],
      sources: ["online"],
      suiteId: SUITE_A,
      orderBy: "created",
      oldestFirst: false,
    });
  });

  it("resolves the Reception choice in Booked via into every reception source", () => {
    const request = listRequest(parseBookingsQuery({ source: "reception" }, SUITES), NOW);
    expect(request.sources).toEqual(["walk_in", "telephone", "manual", "complimentary"]);
    expect(request.orderBy).toBe("created");
  });

  it("asks for a single row when it only needs a count", () => {
    const request = summaryRequest({ status: "checked_in" }, SUITES, NOW);
    expect(request.pageSize).toBe(1);
    expect(request.statuses).toEqual(["checked_in"]);
  });
});

describe("[CLIENT console redesign brief] every summary card opens exactly the list it counts", () => {
  it("links each card to its own filters and marks it selected only when they match", () => {
    const filters = summaryFilters(NOW);
    expect(filters.today).toEqual({ period: "today", status: "visits" });
    expect(filters.upcoming).toEqual({ period: "upcoming", status: "confirmed" });
    expect(filters.inSuite).toEqual({ status: "checked_in" });
    expect(filters.attention).toEqual({ status: "attention" });
    expect(filters.cancelled).toEqual({ status: "cancelled", from: "2026-09-01", to: "2026-09-30" });

    expect(matchesFilters(parseBookingsQuery({ status: "attention" }, SUITES), filters.attention, SUITES)).toBe(true);
    expect(matchesFilters(parseBookingsQuery({ status: "attention", q: "Omar" }, SUITES), filters.attention, SUITES)).toBe(false);
    expect(matchesFilters(parseBookingsQuery({ status: "attention", page: "3" }, SUITES), filters.attention, SUITES)).toBe(true);
  });

  it("names the current Dubai month and its last day", () => {
    expect(monthBounds(new Date("2026-02-10T08:00:00Z"))).toEqual({ first: "2026-02-01", last: "2026-02-28", label: "February" });
    expect(monthBounds(new Date("2026-08-31T21:00:00Z")).first).toBe("2026-09-01");
  });
});

describe("[CLIENT console redesign brief] list links keep the filters and drop the page", () => {
  it("resets the page whenever anything else changes", () => {
    expect(bookingsHref({ status: "cancelled", page: "3" }, { dir: "asc" })).toBe(`${BOOKINGS_PATH}?status=cancelled&dir=asc`);
    expect(bookingsHref({ status: "cancelled" }, { page: "2" })).toBe(`${BOOKINGS_PATH}?status=cancelled&page=2`);
    expect(bookingsHref({}, { page: null })).toBe(BOOKINGS_PATH);
  });

  it("exports the filtered list without a page number", () => {
    expect(exportHref({ status: "cancelled", page: "3", q: "Lena" })).toBe("/api/console/bookings/export?status=cancelled&q=Lena");
    expect(exportHref({})).toBe("/api/console/bookings/export");
  });
});
