import { describe, expect, it } from "vitest";

import {
  dubaiDayStart,
  financeHref,
  financeWindows,
  isFinanceFiltered,
  listWindow,
  monthWindow,
  parseFinanceQuery,
  periodWindow,
  shiftIsoDate,
} from "@/app/(console)/manage/finance/finance-query";
import {
  INVOICE_STATE_LABEL,
  PAYMENT_STATUS_FILTER,
  PAYMENT_STATUS_FILTERS,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  canConfirmReturn,
  canWithdraw,
  financeDay,
  isRefundable,
  refundOrigin,
  suiteLabel,
} from "@/components/console/manage/finance/finance-labels";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import type { LedgerPaymentStatus } from "@/lib/db/queries/management-payments";

describe("[CLIENT console redesign brief 2026-09-11] finance list queries", () => {
  it("reads an empty query as every record, newest first, on page one", () => {
    expect(parseFinanceQuery({})).toEqual({ search: "", period: "all", from: null, to: null, page: 1 });
  });

  it("ignores values the URL should not carry", () => {
    expect(parseFinanceQuery({ period: "year", page: "abc", from: "2026-02-30" })).toEqual({
      search: "",
      period: "all",
      from: null,
      to: null,
      page: 1,
    });
    expect(parseFinanceQuery({ page: "-2" }).page).toBe(1);
    expect(parseFinanceQuery({ page: ["2", "3"] }).page).toBe(1);
  });

  it("trims and bounds the search term", () => {
    expect(parseFinanceQuery({ q: "  WPTEST01  " }).search).toBe("WPTEST01");
    expect(parseFinanceQuery({ q: "x".repeat(500) }).search).toHaveLength(CONSOLE_LIST.searchMaxLength);
  });

  it("puts a reversed date range the right way round and completes a single day", () => {
    expect(parseFinanceQuery({ from: "2026-09-12", to: "2026-09-01" })).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-12",
    });
    expect(parseFinanceQuery({ from: "2026-09-05" })).toMatchObject({ from: "2026-09-05", to: "2026-09-05" });
    expect(parseFinanceQuery({ to: "2026-09-05" })).toMatchObject({ from: null, to: null });
  });
});

describe("[INV-24] finance periods are Dubai calendar days", () => {
  it("starts a Dubai day at 20:00 UTC the evening before", () => {
    expect(dubaiDayStart("2026-09-12")).toBe("2026-09-11T20:00:00.000Z");
  });

  it("shifts calendar dates across month and year ends", () => {
    expect(shiftIsoDate("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftIsoDate("2027-01-01", -1)).toBe("2026-12-31");
    expect(shiftIsoDate("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("covers today, the last seven days including today, and the calendar month", () => {
    expect(periodWindow("today", "2026-09-12")).toEqual({
      from: "2026-09-11T20:00:00.000Z",
      to: "2026-09-12T20:00:00.000Z",
    });
    expect(periodWindow("week", "2026-09-12")).toEqual({
      from: "2026-09-05T20:00:00.000Z",
      to: "2026-09-12T20:00:00.000Z",
    });
    expect(periodWindow("month", "2026-09-12")).toEqual({
      from: "2026-08-31T20:00:00.000Z",
      to: "2026-09-30T20:00:00.000Z",
    });
    expect(periodWindow("all", "2026-09-12")).toBeNull();
  });

  it("rolls December into the next January", () => {
    expect(monthWindow("2026-12-15")).toEqual({
      from: "2026-11-30T20:00:00.000Z",
      to: "2026-12-31T20:00:00.000Z",
    });
  });

  it("uses the Dubai date, not the server's, for today and this month", () => {
    const windows = financeWindows(new Date("2026-09-30T21:30:00.000Z"));

    expect(windows.todayIso).toBe("2026-10-01");
    expect(windows.monthLabel).toBe("October 2026");
    expect(windows.today).toEqual({ from: "2026-09-30T20:00:00.000Z", to: "2026-10-01T20:00:00.000Z" });
    expect(windows.month).toEqual({ from: "2026-09-30T20:00:00.000Z", to: "2026-10-31T20:00:00.000Z" });
  });

  it("lets an explicit date range win over the period", () => {
    const query = parseFinanceQuery({ period: "today", from: "2026-09-01", to: "2026-09-03" });

    expect(listWindow(query, "2026-09-12")).toEqual({
      from: "2026-08-31T20:00:00.000Z",
      to: "2026-09-03T20:00:00.000Z",
    });
    expect(listWindow(parseFinanceQuery({ period: "today" }), "2026-09-12")).toEqual(periodWindow("today", "2026-09-12"));
    expect(listWindow(parseFinanceQuery({}), "2026-09-12")).toBeNull();
  });
});

describe("finance list links", () => {
  it("keeps the other filters, drops the page and removes cleared values", () => {
    const params = { q: "Amina", status: "paid", page: "3" };

    expect(financeHref("/manage/finance/payments", params, { status: "awaiting" })).toBe(
      "/manage/finance/payments?q=Amina&status=awaiting",
    );
    expect(financeHref("/manage/finance/payments", params, { q: null, status: null })).toBe("/manage/finance/payments");
    expect(financeHref("/manage/finance/payments", params, { page: "4" })).toBe(
      "/manage/finance/payments?q=Amina&status=paid&page=4",
    );
  });

  it("reports whether anything narrows the list", () => {
    expect(isFinanceFiltered(parseFinanceQuery({}))).toBe(false);
    expect(isFinanceFiltered(parseFinanceQuery({}), [null, null])).toBe(false);
    expect(isFinanceFiltered(parseFinanceQuery({ period: "month" }))).toBe(true);
    expect(isFinanceFiltered(parseFinanceQuery({ q: "WP" }))).toBe(true);
    expect(isFinanceFiltered(parseFinanceQuery({}), ["cash"])).toBe(true);
  });
});

describe("[§8, §11.2] what each finance row allows", () => {
  it("offers a refund only while money that was taken remains refundable", () => {
    expect(isRefundable({ status: "paid", refundableFils: 1000 })).toBe(true);
    expect(isRefundable({ status: "partially_refunded", refundableFils: 1 })).toBe(true);
    expect(isRefundable({ status: "paid", refundableFils: 0 })).toBe(false);
    expect(isRefundable({ status: "fully_refunded", refundableFils: 1000 })).toBe(false);
    expect(isRefundable({ status: "pending", refundableFils: 1000 })).toBe(false);
    expect(isRefundable({ status: "manual_review", refundableFils: 1000 })).toBe(false);
  });

  it("[6.3] lets any pending refund be confirmed as returned, but never withdraws an automatic one", () => {
    expect(canConfirmReturn({ state: "pending" })).toBe(true);
    expect(canConfirmReturn({ state: "returned" })).toBe(false);
    expect(canConfirmReturn({ state: "withdrawn" })).toBe(false);

    expect(canWithdraw({ state: "pending", isAutomatic: false })).toBe(true);
    expect(canWithdraw({ state: "pending", isAutomatic: true })).toBe(false);
    expect(canWithdraw({ state: "returned", isAutomatic: false })).toBe(false);
    expect(canWithdraw({ state: "withdrawn", isAutomatic: false })).toBe(false);
  });

  it("names the origin of a refund from who requested it", () => {
    expect(refundOrigin({ isAutomatic: true })).toBe("automatic");
    expect(refundOrigin({ isAutomatic: false })).toBe("staff");
  });

  it("groups open and pending payments as awaiting payment, and labels every payment state", () => {
    expect(PAYMENT_STATUS_FILTER.awaiting.statuses).toEqual(["open", "pending"]);
    const covered = new Set(PAYMENT_STATUS_FILTERS.flatMap((filter) => PAYMENT_STATUS_FILTER[filter].statuses));
    const every: LedgerPaymentStatus[] = [
      "open", "pending", "paid", "partially_refunded", "fully_refunded", "failed", "cancelled", "manual_review",
    ];
    for (const status of every) {
      expect(covered.has(status), status).toBe(true);
      expect(PAYMENT_STATUS_LABEL[status], status).toBeTruthy();
      expect(PAYMENT_STATUS_TONE[status], status).toBeTruthy();
    }
    expect(INVOICE_STATE_LABEL.voided).toBe("Void");
  });

  it("shows the suite in the console list and a Dubai date", () => {
    expect(suiteLabel(4)).toBe("Suite 4");
    expect(suiteLabel(null)).toBeNull();
    expect(financeDay("2026-09-11T20:30:00.000Z")).toMatch(/^12 Sept? 2026$/);
    expect(financeDay("not a date")).toBe("");
  });
});
