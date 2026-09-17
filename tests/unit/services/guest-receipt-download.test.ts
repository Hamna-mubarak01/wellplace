import { describe, expect, it } from "vitest";

import { receiptView } from "@/lib/documents/receipt-view";
import { receiptSchema } from "@/lib/config/receipt";

const RAW_RECEIPT = {
  reference: "WP-TEST-0001",
  status: "confirmed",
  paymentStatus: "paid",
  checkoutResult: "confirmed",
  paymentReference: "pay_test_123",
  simulated: false,
  currency: "AED",
  paymentOption: "card",
  createdAt: "2026-01-15T09:00:00Z",
  snapshot: {
    progress: {
      identity: {
        salutation: "mr",
        firstName: "Test",
        lastName: "Guest",
        email: "test@example.com",
        dateOfBirth: "1990-01-01",
        phoneE164: "+971500000000",
        phoneCountry: "AE",
      },
      selection: {
        date: "2026-01-15",
        startsAt: "2026-01-15T10:00:00Z",
        durationHours: 3,
        adults: 2,
        childAges: [],
        addonQuantities: {},
        voucherCode: "",
        personalRequest: "",
        paymentOption: "card",
      },
      acceptedTerms: true,
      lastCompletedStep: "payment",
    },
    taxLabel: "VAT",
    offerLabel: "Regular",
    breakdown: {
      totalFils: 100000,
      regularTotalFils: 100000,
      savingFils: 0,
      taxFils: 4762,
      taxIsIncluded: true,
      serviceFeeFils: 0,
      lines: [
        {
          id: "line-1",
          kind: "session",
          label: "Suite session",
          quantity: 1,
          unitPriceFils: 100000,
          regularUnitPriceFils: 100000,
          amountFils: 100000,
          isIncluded: false,
        },
      ],
    },
  },
  refunds: [],
};

describe("guest receipt view", () => {
  it("shows the visit in Dubai time on a 12-hour clock, never the raw UTC instant", () => {
    const view = receiptView(receiptSchema.parse(RAW_RECEIPT));

    expect(view.visitDate).toBe("Thursday, 15 January 2026");
    expect(view.visitTime).toBe("2:00 PM – 5:00 PM");
    expect(JSON.stringify(view)).not.toContain("2026-01-15T10:00:00Z");
  });

  it("falls back to plain wording when no time has been scheduled yet", () => {
    const receipt = receiptSchema.parse({
      ...RAW_RECEIPT,
      snapshot: {
        ...RAW_RECEIPT.snapshot,
        progress: {
          ...RAW_RECEIPT.snapshot.progress,
          selection: { ...RAW_RECEIPT.snapshot.progress.selection, startsAt: null },
        },
      },
    });

    expect(receiptView(receipt).visitTime).toBe("Not yet scheduled");
  });
});
