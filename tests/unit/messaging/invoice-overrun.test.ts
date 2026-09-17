import { describe, expect, it } from "vitest";

import { formatAed } from "@/components/shared/money";
import { invoiceDocument } from "@/lib/messaging/templates/invoice";
import { sampleInvoice } from "../support/invoice";

const OVERSTAY_FILS = 21996;
const OVERSTAY_VAT_FILS = OVERSTAY_FILS - Math.round(OVERSTAY_FILS / 1.05);

function invoiceWithOverstay() {
  const base = sampleInvoice();
  const [visit, ...rest] = base.lines;
  return sampleInvoice({
    lines: [
      visit,
      {
        kind: "overrun",
        label: "Overstay",
        quantity: null,
        unitPriceFils: null,
        amountFils: OVERSTAY_FILS,
        isIncluded: false,
        isTaxable: true,
        minutes: 35,
        adults: null,
        children: null,
        startsAt: null,
        endsAt: null,
      },
      ...rest,
    ],
    overrunFils: OVERSTAY_FILS,
    totalFils: base.totalFils + OVERSTAY_FILS,
    taxFils: base.taxFils + OVERSTAY_VAT_FILS,
    taxableFils: base.taxableFils + OVERSTAY_FILS - OVERSTAY_VAT_FILS,
    paidFils: base.paidFils + OVERSTAY_FILS,
  });
}

describe("[§7.6, §8, INV-21; CLIENT console redesign brief 2026-09-11] an invoice carries a stored overstay charge", () => {
  it("prints the overstay as its own line", () => {
    const line = invoiceDocument(invoiceWithOverstay()).lines.find((row) => row.description === "Overstay");
    expect(line).toMatchObject({ quantity: null, unitPrice: null, amount: formatAed(OVERSTAY_FILS) });
  });

  it("shows an overstay row so the rows above the total add up to it", () => {
    const totals = invoiceDocument(invoiceWithOverstay()).totals;
    const labels = totals.map((row) => row.label);
    expect(labels.indexOf("Overstay")).toBeGreaterThan(labels.indexOf("Service Fee"));
    expect(labels.indexOf("Overstay")).toBeLessThan(labels.indexOf("Total"));
    expect(totals.find((row) => row.label === "Overstay")?.value).toBe(formatAed(OVERSTAY_FILS));
    expect(totals.find((row) => row.label === "Total")?.value).toBe(formatAed(sampleInvoice().totalFils + OVERSTAY_FILS));
  });

  it("shows no overstay row on an invoice without one", () => {
    expect(invoiceDocument(sampleInvoice()).totals.some((row) => row.key === "overrun")).toBe(false);
  });
});
