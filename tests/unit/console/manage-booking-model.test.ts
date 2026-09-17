import { describe, expect, it } from "vitest";

import {
  bookedViaLabel,
  bookingActionGates,
  childAgesLabel,
  compactDuration,
  durationLabel,
  extensionVerdict,
  guestsLabel,
  moneySummary,
  priceRows,
  resolveDisplayStatus,
  visitMinutes,
  type MoneyInput,
  type PriceInput,
} from "@/components/console/manage/bookings/booking-model";
import { BOOKING_STATUSES, canPerform } from "@/lib/domain/booking";

const SUITE = "7e2e0001-0000-4000-8000-000000000001";

describe("[Project owner's direction 2026-09-11] the booking page offers only what the database allows", () => {
  it("allows every Management change on a confirmed booking with a suite", () => {
    expect(bookingActionGates({ status: "confirmed", suiteId: SUITE, otherSuites: 6 })).toEqual({
      extend: null,
      changeSuite: null,
      reschedule: null,
      editDetails: null,
    });
  });

  it("mirrors extend_booking, move_booking and reschedule_booking status refusals for every status", () => {
    for (const status of BOOKING_STATUSES) {
      const gates = bookingActionGates({ status, suiteId: SUITE, otherSuites: 3 });
      expect(gates.extend === null, `extend on ${status}`).toBe(canPerform("extend", status));
      expect(gates.changeSuite === null, `move on ${status}`).toBe(canPerform("move", status));
      expect(gates.reschedule === null, `reschedule on ${status}`).toBe(canPerform("reschedule", status));
      expect(gates.editDetails, `edit on ${status}`).toBeNull();
    }
  });

  it("explains a refusal in words a manager can act on", () => {
    const cancelled = bookingActionGates({ status: "cancelled", suiteId: null, otherSuites: 6 });
    expect(cancelled.extend).toBe("Only a confirmed or checked-in visit can be extended. This booking is cancelled.");
    expect(cancelled.reschedule).toBe("Only a confirmed visit can be rescheduled. This booking is cancelled.");

    const inSuite = bookingActionGates({ status: "checked_in", suiteId: SUITE, otherSuites: 6 });
    expect(inSuite.reschedule).toBe("The guest is already in the suite. Use Extend or Change suite instead.");
    expect(inSuite.extend).toBeNull();
  });

  it("refuses a suite change when no other suite exists or the list could not be read", () => {
    expect(bookingActionGates({ status: "confirmed", suiteId: SUITE, otherSuites: 0 }).changeSuite).toMatch(/no other suite/);
    expect(bookingActionGates({ status: "confirmed", suiteId: SUITE, otherSuites: null }).changeSuite).toMatch(/could not be loaded/);
  });
});

describe("[§7.6, §7.1] an extension is checked against the next claim and its cleaning time", () => {
  const base = {
    endsAt: "2026-09-12T10:00:00Z",
    bufferMinutes: 20,
    hoursRefusal: null,
  };

  it("fits when the new end leaves the cleaning time before the next claim", () => {
    expect(extensionVerdict({ ...base, extraMinutes: 40, nextClaimAt: "2026-09-12T11:00:00Z" })).toEqual({
      status: "fits",
      freeUntil: "2026-09-12T10:40:00.000Z",
    });
  });

  it("refuses one minute past that point and says how much room there is", () => {
    const verdict = extensionVerdict({ ...base, extraMinutes: 41, nextClaimAt: "2026-09-12T11:00:00Z" });
    expect(verdict.status).toBe("conflict");
    expect(verdict.status === "conflict" && verdict.message).toContain("40 extra minutes");
  });

  it("reports no room when the next claim starts within the cleaning time", () => {
    const verdict = extensionVerdict({ ...base, extraMinutes: 5, nextClaimAt: "2026-09-12T10:20:00Z" });
    expect(verdict.status === "conflict" && verdict.message).toContain("no room for extra time");
  });

  it("fits with nothing after it, and refuses when the opening hours would be passed", () => {
    expect(extensionVerdict({ ...base, extraMinutes: 90, nextClaimAt: null })).toEqual({ status: "fits", freeUntil: null });
    expect(
      extensionVerdict({ ...base, extraMinutes: 90, nextClaimAt: null, hoursRefusal: "WellPlace is open 10:00–22:00 on this date." }),
    ).toEqual({ status: "conflict", freeUntil: null, message: "WellPlace is open 10:00–22:00 on this date." });
  });
});

describe("[INV-21] the money cards add up stored figures and never re-price", () => {
  const confirmed: MoneyInput = {
    status: "confirmed",
    totalFils: 66_000,
    overrunFils: null,
    paidFils: 20_000,
    refundedFils: 0,
    refundsPendingFils: 0,
    isComplimentary: false,
  };

  it("shows what is still owed on a standing booking", () => {
    expect(moneySummary(confirmed)).toMatchObject({ balanceFils: 46_000, balance: "due", netReceivedFils: 20_000 });
  });

  it("counts an unpaid overstay charge in the balance", () => {
    expect(moneySummary({ ...confirmed, status: "completed", paidFils: 66_000, overrunFils: 4_500 })).toMatchObject({
      balanceFils: 4_500,
      balance: "due",
    });
  });

  it("is settled when the payments cover it, and never negative", () => {
    expect(moneySummary({ ...confirmed, paidFils: 70_000 })).toMatchObject({ balanceFils: 0, balance: "settled" });
  });

  it("has no balance on a closed or complimentary booking", () => {
    expect(moneySummary({ ...confirmed, status: "cancelled" })).toMatchObject({ balanceFils: null, balance: "closed" });
    expect(moneySummary({ ...confirmed, isComplimentary: true })).toMatchObject({ balanceFils: 0, balance: "complimentary" });
    expect(moneySummary({ ...confirmed, totalFils: null })).toMatchObject({ balanceFils: null, balance: "unpriced" });
  });

  it("subtracts only returned refunds from the money received", () => {
    expect(moneySummary({ ...confirmed, paidFils: 66_000, refundedFils: 10_000, refundsPendingFils: 5_000 })).toMatchObject({
      netReceivedFils: 56_000,
      refundsPendingFils: 5_000,
    });
  });
});

describe("[INV-21, Q-4] the price breakdown shows the stored lines", () => {
  const priced: PriceInput = {
    subtotalFils: 66_000,
    discountFils: 6_000,
    addonsFils: 3_000,
    serviceFeeFils: 0,
    taxFils: 3_000,
    totalFils: 63_000,
    overrunFils: null,
    overrunMinutes: null,
    addons: [{ name: "Bathrobe", quantity: 2, lineTotalFils: 3_000 }],
    visitLabel: "2 hours · 2 adults",
    taxLabel: "VAT",
    taxIsIncluded: true,
  };

  it("lists the visit, add-ons, discount and total, with VAT shown as included", () => {
    expect(priceRows(priced).map((row) => [row.kind, row.label, row.amountFils])).toEqual([
      ["visit", "Visit", 66_000],
      ["addon", "Bathrobe × 2", 3_000],
      ["discount", "Discount", -6_000],
      ["total", "Total", 63_000],
      ["included", "Includes VAT", 3_000],
    ]);
  });

  it("adds exclusive tax as its own line", () => {
    const rows = priceRows({ ...priced, taxIsIncluded: false, totalFils: 66_000 });
    expect(rows.find((row) => row.kind === "tax")).toMatchObject({ label: "VAT", amountFils: 3_000 });
    expect(rows.some((row) => row.kind === "adjustment")).toBe(false);
  });

  it("marks add-ons as included when a manual price folded them into the visit", () => {
    const rows = priceRows({ ...priced, subtotalFils: 50_000, discountFils: 0, addonsFils: 0, taxFils: 0, totalFils: 50_000 });
    expect(rows.find((row) => row.kind === "addon")).toMatchObject({ amountFils: null, detail: "Included in the price" });
    expect(rows.some((row) => row.kind === "adjustment")).toBe(false);
  });

  it("explains a stored total that the lines do not reach instead of recomputing it", () => {
    const rows = priceRows({ ...priced, totalFils: 64_000 });
    expect(rows.find((row) => row.kind === "adjustment")).toMatchObject({ amountFils: 1_000 });
    expect(rows.find((row) => row.kind === "total")).toMatchObject({ amountFils: 64_000 });
  });

  it("keeps the overstay charge outside the total", () => {
    const rows = priceRows({ ...priced, overrunFils: 4_500, overrunMinutes: 15 });
    expect(rows.at(-1)).toMatchObject({ kind: "overrun", amountFils: 4_500 });
    expect(rows.find((row) => row.kind === "total")).toMatchObject({ amountFils: 63_000 });
  });

  it("shows nothing when no price is stored", () => {
    expect(priceRows({ ...priced, totalFils: null })).toEqual([]);
  });
});

describe("[OUR CHOICE — project owner's direction, 13 September 2026] website or Reception at a glance", () => {
  it("names the staff member who created a Reception booking", () => {
    expect(bookedViaLabel("walk_in", "Sara Ahmed")).toBe("Sara Ahmed");
    expect(bookedViaLabel("telephone", "Omar Khan")).toBe("Omar Khan");
  });

  it("falls back to Reception when no staff name was recorded", () => {
    expect(bookedViaLabel("manual", null)).toBe("Reception");
    expect(bookedViaLabel("complimentary", undefined)).toBe("Reception");
  });

  it("always reads Website for an online booking, whatever the recorded name is", () => {
    expect(bookedViaLabel("online", null)).toBe("Website");
    expect(bookedViaLabel("online", "Ignored")).toBe("Website");
  });
});

describe("[OUR CHOICE — project owner's direction, 13 September 2026] abandoned bookings are derived, never stored", () => {
  it("shows the derived status when the read model computed one", () => {
    expect(resolveDisplayStatus("awaiting_payment", "abandoned")).toBe("abandoned");
  });

  it("falls back to the stored status when nothing was derived", () => {
    expect(resolveDisplayStatus("confirmed", undefined)).toBe("confirmed");
    expect(resolveDisplayStatus("confirmed", null)).toBe("confirmed");
  });
});

describe("booking labels", () => {
  it("formats lengths, guests and child ages", () => {
    expect(visitMinutes("2026-09-12T10:00:00Z", "2026-09-12T13:30:00Z")).toBe(210);
    expect(visitMinutes("2026-09-12T10:00:00Z", "2026-09-12T09:00:00Z")).toBe(0);
    expect(durationLabel(210)).toBe("3 hours 30 min");
    expect(durationLabel(60)).toBe("1 hour");
    expect(durationLabel(0)).toBe("No length recorded");
    expect(compactDuration(120)).toBe("2 h");
    expect(guestsLabel(1, 0)).toBe("1 adult");
    expect(guestsLabel(2, 1)).toBe("2 adults, 1 child");
    expect(childAgesLabel([9, null])).toBe("Aged 9, age not recorded");
    expect(childAgesLabel([])).toBeNull();
  });
});
