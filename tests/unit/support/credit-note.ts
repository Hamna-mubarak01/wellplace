import type { CreditNotePdfSource } from "@/lib/documents/credit-note-pdf-view";

import { SAMPLE_BOOKING_ID, SAMPLE_CUSTOMER_ID, SAMPLE_INVOICE_ID, SAMPLE_ISSUER_NAME, SAMPLE_TRN } from "./invoice";

export const SAMPLE_CREDIT_NOTE_ID = "7c6b5a4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d";

export function sampleCreditNote(overrides: Partial<CreditNotePdfSource> = {}): CreditNotePdfSource {
  return {
    id: SAMPLE_CREDIT_NOTE_ID,
    creditNoteNumber: "CN-2026-000007",
    sequenceNo: 7,
    invoiceId: SAMPLE_INVOICE_ID,
    invoiceNumber: "INV-2026-000042",
    invoiceIssuedAt: "2026-09-11T20:30:00.000Z",
    refundId: "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a",
    bookingId: SAMPLE_BOOKING_ID,
    bookingReference: "WP-B1042",
    customerId: SAMPLE_CUSTOMER_ID,
    customerReference: "WP-C1042",
    issuedAt: "2026-09-14T06:00:00.000Z",
    issuedBy: null,
    supplyDate: "2026-09-12",
    issuer: { legalName: SAMPLE_ISSUER_NAME, trn: SAMPLE_TRN, address: "Unit 1, Example Street\nTest City, UAE" },
    billTo: {
      salutation: "ms",
      firstName: "Amina",
      lastName: "Tester",
      name: "Amina Tester",
      email: "guest@example.test",
      phoneE164: "+971500000000",
      company: null,
      trn: null,
      address: null,
    },
    tax: { label: "VAT", ratePercent: 5, isIncluded: true },
    lines: [
      {
        kind: "refund",
        label: "Refund against booking WP-B1042",
        quantity: 1,
        unitPriceFils: 21000,
        amountFils: 21000,
        isIncluded: false,
        isTaxable: true,
        vatRatePercent: 5,
        vatFils: 1000,
      },
    ],
    refund: {
      refundId: "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a",
      reference: "WP-R1003",
      providerReference: "sim-refund-1",
      requestedAt: "2026-09-13T08:00:00.000Z",
      settledAt: "2026-09-14T05:55:00.000Z",
      paymentId: "3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b",
      paymentReference: "WP-P1001",
      paymentMethod: "online",
    },
    reason: "The guest left early.",
    amountFils: 21000,
    taxFils: 1000,
    taxableFils: 20000,
    currency: "AED",
    isTest: true,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    ...overrides,
  };
}
