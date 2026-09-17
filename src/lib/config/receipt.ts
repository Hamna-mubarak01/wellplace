import { z } from "zod";
import { checkoutProgressSchema } from "@/lib/config/checkout-flow";
import { guestDocumentSummarySchema, type TaxDocumentType } from "@/lib/db/invoice-record";
export const receiptSchema = z.object({
  reference: z.string(),
  status: z.string(),
  paymentStatus: z.string(),
  checkoutResult: z.enum(["confirmed", "refunded"]).optional(),
  paymentReference: z.string().nullable().optional(),
  paymentNumber: z.string().nullable().optional(),
  simulated: z.boolean(),
  currency: z.literal("AED"),
  paymentOption: z.string(),
  createdAt: z.string(),
  snapshot: z.object({
    progress: checkoutProgressSchema,
    taxLabel: z.string(),
    offerLabel: z.string(),
    breakdown: z.object({
      totalFils: z.number().int(),
      regularTotalFils: z.number().int(),
      savingFils: z.number().int(),
      taxFils: z.number().int(),
      taxIsIncluded: z.boolean(),
      serviceFeeFils: z.number().int(),
      lines: z.array(
        z.object({
          id: z.string(),
          kind: z.string(),
          label: z.string(),
          quantity: z.number().nullable(),
          unitPriceFils: z.number().nullable(),
          regularUnitPriceFils: z.number().nullable(),
          amountFils: z.number(),
          isIncluded: z.boolean().optional(),
        }),
      ),
    }),
  }),
  refunds: z.array(
    z.object({
      id: z.uuid(),
      amountFils: z.number().int().positive(),
      taxFils: z.number().int().nonnegative().default(0),
      pending: z.boolean(),
      settledAt: z.string().nullable(),
      requestedAt: z.string(),
    }),
  ),
  documents: z.array(guestDocumentSummarySchema).default([]),
});
export type GuestReceipt = z.infer<typeof receiptSchema>;

export const RECEIPT_LINK = {
  validDaysAfterVisit: 90,
  path: "/book/receipt",
  celebrateParam: "paid",
} as const;

export function receiptPagePath(token: string, celebrate = false): string {
  return `${RECEIPT_LINK.path}/${token}${celebrate ? `?${RECEIPT_LINK.celebrateParam}=1` : ""}`;
}

export function receiptDownloadPath(token: string): string {
  return `/api/booking/receipt/${token}`;
}

export const RECEIPT_COPY = {
  documents: {
    heading: "Tax documents",
    typeLabel: { invoice: "Tax invoice", credit_note: "Credit note" } satisfies Record<TaxDocumentType, string>,
    credits: "Credits {number}",
    download: "Download PDF",
    downloadFailed: "Your document could not be prepared. Please try again, or contact WellPlace.",
  },
} as const;

export function receiptDocumentPath(token: string, documentId: string): string {
  return `/api/booking/receipt/${token}/documents/${documentId}`;
}
