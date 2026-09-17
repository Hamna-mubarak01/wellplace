import { describe, expect, it } from "vitest";

import {
  ANY,
  BOOKING_SOURCES,
  BOOKING_SOURCE_LABEL,
  BOOKING_STATUS_LABEL,
  GUEST_TYPES,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  isFiltered,
  parseBookingSearch,
  searchKeysFor,
} from "@/components/console/reception/booking-filters";
import { BOOKING_STATUSES } from "@/lib/domain/booking";

const SUITES = ["s1", "s2"];

describe("§9.1 — filters by booking status, payment status, source, guest type and suite", () => {
  it("offers all five filter axes", () => {
    const query = parseBookingSearch(
      {
        status: "confirmed",
        payment: "paid",
        source: "walk_in",
        guests: "with_children",
        suite: "s2",
      },
      SUITES,
    );

    expect(query.status).toBe("confirmed");
    expect(query.paymentStatus).toBe("paid");
    expect(query.source).toBe("walk_in");
    expect(query.guestType).toBe("with_children");
    expect(query.suiteId).toBe("s2");
  });

  it("falls back to any for a value that is not offered", () => {
    const query = parseBookingSearch(
      {
        status: "nonsense",
        payment: "nonsense",
        source: "nonsense",
        guests: "nonsense",
        suite: "not-a-suite",
      },
      SUITES,
    );

    expect(query.status).toBe(ANY);
    expect(query.paymentStatus).toBe(ANY);
    expect(query.source).toBe(ANY);
    expect(query.guestType).toBe(ANY);
    expect(query.suiteId).toBe(ANY);
  });

  it("refuses a suite id that is not one of ours, so the filter cannot be forged", () => {
    expect(parseBookingSearch({ suite: "../etc" }, SUITES).suiteId).toBe(ANY);
  });

  it("names the four §9.2 creation sources plus online", () => {
    expect([...BOOKING_SOURCES]).toEqual([
      "online",
      "walk_in",
      "telephone",
      "manual",
      "complimentary",
    ]);
  });

  it("§8 — offers all eight payment states", () => {
    expect(PAYMENT_STATUSES).toHaveLength(8);
    for (const status of PAYMENT_STATUSES) {
      expect(PAYMENT_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it("labels every booking status and source", () => {
    for (const status of BOOKING_STATUSES) {
      expect(BOOKING_STATUS_LABEL[status]).toBeTruthy();
    }
    for (const source of BOOKING_SOURCES) {
      expect(BOOKING_SOURCE_LABEL[source]).toBeTruthy();
    }
  });

  it("reads guest type as adults only or with children", () => {
    expect([...GUEST_TYPES]).toEqual(["adults_only", "with_children"]);
  });
});

describe("pagination and the filtered flag", () => {
  it("defaults to page one and rejects a bad page", () => {
    expect(parseBookingSearch({}, SUITES).page).toBe(1);
    expect(parseBookingSearch({ page: "0" }, SUITES).page).toBe(1);
    expect(parseBookingSearch({ page: "-3" }, SUITES).page).toBe(1);
    expect(parseBookingSearch({ page: "abc" }, SUITES).page).toBe(1);
    expect(parseBookingSearch({ page: "4" }, SUITES).page).toBe(4);
  });

  it("knows when nothing is filtered", () => {
    expect(isFiltered(parseBookingSearch({}, SUITES))).toBe(false);
    expect(isFiltered(parseBookingSearch({ q: "  " }, SUITES))).toBe(false);
  });

  it("knows when something is", () => {
    expect(isFiltered(parseBookingSearch({ q: "khan" }, SUITES))).toBe(true);
    expect(isFiltered(parseBookingSearch({ status: "no_show" }, SUITES))).toBe(true);
    expect(isFiltered(parseBookingSearch({ suite: "s1" }, SUITES))).toBe(true);
  });
});

describe("§9.1 — search by name, mobile, email, booking reference and payment reference", () => {
  it("reads an address as an email search", () => {
    expect(searchKeysFor("guest@example.ae")).toEqual(["email"]);
  });

  it("reads a dialled number as a mobile search", () => {
    expect(searchKeysFor("+971 50 123 4567")).toEqual(["mobile"]);
  });

  it("reads a reference as a booking or payment reference", () => {
    expect(searchKeysFor("WP-000123")).toEqual([
      "booking_reference",
      "payment_reference",
    ]);
  });

  it("falls back to name and the two references for free text", () => {
    expect(searchKeysFor("Amina")).toEqual([
      "name",
      "booking_reference",
      "payment_reference",
    ]);
  });

  it("searches nothing for an empty term", () => {
    expect(searchKeysFor("   ")).toHaveLength(0);
  });

  it("covers all five keys the contract names", () => {
    const keys = new Set([
      ...searchKeysFor("guest@example.ae"),
      ...searchKeysFor("+971501234567"),
      ...searchKeysFor("WP-000123"),
      ...searchKeysFor("Amina"),
    ]);

    expect([...keys].toSorted()).toEqual([
      "booking_reference",
      "email",
      "mobile",
      "name",
      "payment_reference",
    ]);
  });
});

describe("booking periods and Dubai calendar dates", () => {
  it("normalises retired periods and retains arrival filters", () => {
    const query = parseBookingSearch({ period: "past", arrival: "checked_out", from: "2026-09-01", to: "2026-09-30" }, SUITES);
    expect(query.period).toBe("all"); expect(query.arrival).toBe("checked_out");
    expect(query.from).toBe("2026-09-01"); expect(query.to).toBe("2026-09-30"); expect(isFiltered(query)).toBe(true);
  });
  it("rejects impossible dates, invalid periods and unsafe page numbers", () => {
    const query = parseBookingSearch({ period: "bad", arrival: "bad", from: "2026-02-30", to: "2026-09-30", page: "999999999999999999999" }, SUITES);
    expect(query.period).toBe("all"); expect(query.arrival).toBe(ANY); expect(query.from).toBeUndefined(); expect(query.to).toBeUndefined(); expect(query.page).toBe(1);
  });
  it.each(["0.04", "1.04", String(Number.MAX_SAFE_INTEGER)])("rejects fractional pages and unsafe pagination offsets: %s", (page) => {
    expect(parseBookingSearch({ page }, SUITES).page).toBe(1);
  });
  it("treats a single date or reversed end as a single-day filter", () => {
    expect(parseBookingSearch({ from: "2026-09-10" }, SUITES).to).toBe("2026-09-10");
    expect(parseBookingSearch({ from: "2026-09-10", to: "2026-09-01" }, SUITES).to).toBe("2026-09-10");
  });
});
