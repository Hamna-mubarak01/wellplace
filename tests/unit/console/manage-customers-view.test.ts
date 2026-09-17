import { describe, expect, it } from "vitest";

import {
  CUSTOMERS_PATH,
  customerBookingsHref,
  customerHref,
  customersHref,
  dubaiMonthStart,
  isFiltered,
  parseCustomersQuery,
  positivePage,
  shownPage,
} from "@/app/(console)/manage/customers/customers-query";
import {
  ageOn,
  countryName,
  customerFlags,
  customerStatus,
  displayName,
  documentTitle,
  formatCalendarDate,
  formatPhone,
  formatVisitTimes,
  isReturning,
  receiptHref,
  receiptsFromPayments,
  splitDocuments,
} from "@/components/console/manage/customers/customer-view";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import type { CustomerDocument } from "@/lib/db/queries/management-customers";
import type { PaymentLedgerRow } from "@/lib/db/queries/management-payments";

const BOOKING_A = "7e2e0001-0000-4000-8000-00000000000a";
const BOOKING_B = "7e2e0001-0000-4000-8000-00000000000b";
const CUSTOMER = "7e2e0001-0000-4000-8000-0000000000c1";

function payment(overrides: Partial<PaymentLedgerRow> & Pick<PaymentLedgerRow, "id">): PaymentLedgerRow {
  return {
    bookingId: BOOKING_A,
    bookingReference: "WP-A1",
    suiteId: null,
    suiteNumber: null,
    customerId: CUSTOMER,
    customerName: "Mariam Haddad",
    customerEmail: "mariam@example.test",
    method: "online",
    status: "paid",
    amountFils: 66_000,
    serviceFeeFils: 0,
    taxFils: 0,
    isSimulated: false,
    providerReference: null,
    note: null,
    recordedAt: "2026-09-10T08:00:00Z",
    recordedByName: null,
    refundRequestedFils: 0,
    refundPendingFils: 0,
    refundedFils: 0,
    refundableFils: 66_000,
    ...overrides,
  };
}

describe("[CLIENT console redesign §6] the customer list reads only validated URL state", () => {
  it("falls back to the full, most recent first page when nothing is chosen", () => {
    expect(parseCustomersQuery({})).toEqual({ search: "", filter: null, sort: "recent", page: 1 });
  });

  it("keeps a known filter, sort and page", () => {
    expect(parseCustomersQuery({ q: "  mariam ", filter: "returning", sort: "value", page: "3" })).toEqual({
      search: "mariam",
      filter: "returning",
      sort: "value",
      page: 3,
    });
  });

  it("narrows the customer list only to returning or upcoming, since leads and blocked have their own pages", () => {
    expect(parseCustomersQuery({ filter: "upcoming" })).toMatchObject({ filter: "upcoming" });
    for (const filter of ["leads", "customers", "blocked"]) {
      expect(parseCustomersQuery({ filter })).toMatchObject({ filter: null });
    }
  });

  it("ignores unknown or malformed values instead of passing them to the query", () => {
    expect(parseCustomersQuery({ filter: "all", sort: "oldest", page: "0" })).toMatchObject({
      filter: null,
      sort: "recent",
      page: 1,
    });
    expect(parseCustomersQuery({ filter: ["blocked", "upcoming"], sort: ["name"] })).toMatchObject({
      filter: null,
      sort: "recent",
    });
    for (const page of ["-2", "2.5", "abc", "1e3", ""]) expect(positivePage(page)).toBe(1);
  });

  it("caps the search term at the console limit", () => {
    const long = "a".repeat(CONSOLE_LIST.searchMaxLength + 20);
    expect(parseCustomersQuery({ q: long }).search).toHaveLength(CONSOLE_LIST.searchMaxLength);
  });

  it("treats a search or a narrowing filter as filtered, but not a sort", () => {
    expect(isFiltered(parseCustomersQuery({ sort: "name" }))).toBe(false);
    expect(isFiltered(parseCustomersQuery({ q: "omar" }))).toBe(true);
    expect(isFiltered(parseCustomersQuery({ filter: "upcoming" }))).toBe(true);
  });

  it("builds list links that drop the page unless a page is chosen", () => {
    const params = { q: "omar", filter: "upcoming", page: "4" };
    expect(customersHref(params, { filter: "returning" })).toBe(`${CUSTOMERS_PATH}?q=omar&filter=returning`);
    expect(customersHref(params, { page: "2" })).toBe(`${CUSTOMERS_PATH}?q=omar&filter=upcoming&page=2`);
    expect(customersHref({ filter: "blocked" }, { filter: null })).toBe(CUSTOMERS_PATH);
  });

  it("puts only the customer id in a record link", () => {
    expect(customerHref(CUSTOMER)).toBe(`${CUSTOMERS_PATH}/${CUSTOMER}`);
    expect(customerBookingsHref(CUSTOMER, 1)).toBe(`${CUSTOMERS_PATH}/${CUSTOMER}#customer-bookings`);
    expect(customerBookingsHref(CUSTOMER, 3)).toBe(`${CUSTOMERS_PATH}/${CUSTOMER}?bookings=3#customer-bookings`);
  });

  it("shows the first page when the requested bookings page is past the end", () => {
    expect(shownPage(2, 45, 20)).toBe(2);
    expect(shownPage(3, 45, 20)).toBe(3);
    expect(shownPage(4, 45, 20)).toBe(1);
    expect(shownPage(2, 0, 20)).toBe(1);
  });

  it("starts the month at Dubai midnight on the first", () => {
    expect(dubaiMonthStart(new Date("2026-09-11T10:00:00Z"))).toBe("2026-08-31T20:00:00.000Z");
    expect(dubaiMonthStart(new Date("2026-09-30T21:00:00Z"))).toBe("2026-09-30T20:00:00.000Z");
    expect(dubaiMonthStart(new Date("2026-09-30T19:59:00Z"))).toBe("2026-08-31T20:00:00.000Z");
  });
});

describe("[CLIENT console redesign §6] a returning guest's standing is visible at a glance", () => {
  it("calls a guest returning from their second completed visit", () => {
    expect(isReturning({ completedCount: 1 })).toBe(false);
    expect(isReturning({ completedCount: 2 })).toBe(true);
  });

  it("flags only a blocked guest; warnings are gone [Project owner's direction, 14 September 2026]", () => {
    expect(customerFlags({ isBlocked: false })).toEqual([]);
    expect(customerFlags({ isBlocked: true }).map((flag) => [flag.id, flag.tone])).toEqual([["blocked", "danger"]]);
  });

  it("never renders an empty name", () => {
    expect(displayName({ fullName: "  " })).toBe("Name not given");
    expect(displayName({ fullName: "Omar Saleh" })).toBe("Omar Saleh");
  });
});

describe("[OUR CHOICE — project owner's direction, 13 September 2026] the status column is never empty", () => {
  it("calls a customer with no completed visit a lead, whatever their booking count", () => {
    expect(customerStatus({ isLead: true, completedCount: 0 })).toEqual({ id: "lead", label: "Lead", tone: "neutral" });
    expect(customerStatus({ isLead: true, completedCount: 5 })).toEqual({ id: "lead", label: "Lead", tone: "neutral" });
  });

  it("calls a non-lead with fewer than two completed visits a customer", () => {
    expect(customerStatus({ isLead: false, completedCount: 0 })).toEqual({
      id: "customer",
      label: "Customer",
      tone: "info",
    });
    expect(customerStatus({ isLead: false, completedCount: 1 })).toEqual({
      id: "customer",
      label: "Customer",
      tone: "info",
    });
  });

  it("calls a non-lead with two or more completed visits returning, at the threshold", () => {
    expect(customerStatus({ isLead: false, completedCount: 2 })).toEqual({
      id: "returning",
      label: "Returning",
      tone: "brand",
    });
  });

  it("keeps blocked as its own chip beside the status", () => {
    const flags = customerFlags({ isBlocked: true });
    const status = customerStatus({ isLead: false, completedCount: 3 });
    expect(status.id).toBe("returning");
    expect(flags.map((flag) => flag.id)).toEqual(["blocked"]);
  });
});

describe("[CLIENT console redesign §6] personal details read the way staff say them", () => {
  it("counts age in whole years on the Dubai calendar date", () => {
    expect(ageOn("1990-09-11", "2026-09-11")).toBe(36);
    expect(ageOn("1990-09-12", "2026-09-11")).toBe(35);
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
  });

  it("has no age for a missing, malformed or future date of birth", () => {
    expect(ageOn(null, "2026-09-11")).toBeNull();
    expect(ageOn("11/09/1990", "2026-09-11")).toBeNull();
    expect(ageOn("2027-01-01", "2026-09-11")).toBeNull();
  });

  it("writes a calendar date without shifting it across a time zone", () => {
    expect(formatCalendarDate("1990-11-28")).toBe("28 November 1990");
    expect(formatCalendarDate("not a date")).toBe("");
  });

  it("formats a stored phone number internationally and keeps anything unparseable", () => {
    expect(formatPhone("+971501234567")).toBe("+971 50 123 4567");
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("  ")).toBe("");
  });

  it("names the phone country from its code", () => {
    expect(countryName("AE")).toBe("United Arab Emirates");
    expect(countryName("ae")).toBe("United Arab Emirates");
    expect(countryName("")).toBeNull();
    expect(countryName("zz")).toBe("ZZ");
  });

  it("shows a visit as its Dubai start and end times", () => {
    expect(formatVisitTimes("2026-09-12T10:00:00Z", "2026-09-12T13:00:00Z")).toBe("14:00–17:00");
  });
});

describe("[Project owner's direction, 11 September 2026] documents on file are terms, invoices and receipts", () => {
  it("names a known legal document and humanises any other", () => {
    expect(documentTitle("privacy-policy")).toBe("Privacy Policy");
    expect(documentTitle("house-rules")).toBe("House rules");
  });

  it("separates invoices from accepted terms without reordering either", () => {
    const documents: CustomerDocument[] = [
      { kind: "invoice", id: "i2", bookingId: BOOKING_B, bookingReference: "WP-B1", issuedAt: "2026-09-10T08:00:00Z", invoiceNumber: "WP-0002", state: "issued", totalFils: 1, currency: "AED" },
      { kind: "invoice", id: "i1", bookingId: BOOKING_A, bookingReference: "WP-A1", issuedAt: "2026-09-01T08:00:00Z", invoiceNumber: "WP-0001", state: "voided", totalFils: 1, currency: "AED" },
      { kind: "acceptance", id: "a1", bookingId: BOOKING_A, bookingReference: "WP-A1", acceptedAt: "2026-09-01T07:00:00Z", source: "online", documentSlug: "legal-terms", documentVersion: "1.3", checkboxText: "I agree" },
    ];
    const { invoices, acceptances } = splitDocuments(documents);
    expect(invoices.map((invoice) => invoice.id)).toEqual(["i2", "i1"]);
    expect(acceptances.map((acceptance) => acceptance.id)).toEqual(["a1"]);
  });

  it("offers one receipt per booking that received money, newest first", () => {
    const receipts = receiptsFromPayments([
      payment({ id: "p1", bookingId: BOOKING_A, bookingReference: "WP-A1", amountFils: 30_000, recordedAt: "2026-09-01T08:00:00Z" }),
      payment({ id: "p2", bookingId: BOOKING_B, bookingReference: "WP-B1", amountFils: 50_000, status: "partially_refunded", recordedAt: "2026-09-05T08:00:00Z" }),
      payment({ id: "p3", bookingId: BOOKING_A, bookingReference: "WP-A1", amountFils: 36_000, recordedAt: "2026-09-08T08:00:00Z" }),
      payment({ id: "p4", bookingId: BOOKING_A, bookingReference: "WP-A1", amountFils: 99_000, status: "failed", recordedAt: "2026-09-09T08:00:00Z" }),
      payment({ id: "p5", bookingId: "7e2e0001-0000-4000-8000-00000000000c", bookingReference: "WP-C1", status: "pending" }),
    ]);
    expect(receipts).toEqual([
      { bookingId: BOOKING_A, bookingReference: "WP-A1", lastPaidAt: "2026-09-08T08:00:00Z", receivedFils: 66_000, simulated: false },
      { bookingId: BOOKING_B, bookingReference: "WP-B1", lastPaidAt: "2026-09-05T08:00:00Z", receivedFils: 50_000, simulated: false },
    ]);
    expect(receiptHref(BOOKING_A)).toBe(`/manage/bookings/${BOOKING_A}/receipt`);
  });

  it("marks a receipt as a simulation only when every payment on it was simulated", () => {
    const mixed = receiptsFromPayments([
      payment({ id: "p1", isSimulated: true }),
      payment({ id: "p2", isSimulated: false, recordedAt: "2026-09-11T08:00:00Z" }),
    ]);
    const simulated = receiptsFromPayments([payment({ id: "p1", isSimulated: true })]);
    expect(mixed[0]?.simulated).toBe(false);
    expect(simulated[0]?.simulated).toBe(true);
  });

  it("offers no receipt for a customer who has not paid", () => {
    expect(receiptsFromPayments([payment({ id: "p1", status: "failed" }), payment({ id: "p2", status: "open" })])).toEqual([]);
  });
});
