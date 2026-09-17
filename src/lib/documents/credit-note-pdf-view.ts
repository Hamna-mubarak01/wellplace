import { formatAed } from "@/components/shared/money";
import { INVOICE_COPY } from "@/lib/config/invoice";
import type { CreditNote } from "@/lib/db/invoice-record";
import {
  filled,
  paymentMethodLabel,
  pdfBillTo,
  pdfIssuer,
  percent,
  vatTotalLabel,
} from "@/lib/documents/invoice-pdf-view";
import { renderTaxDocumentPdf, type TaxDocumentView } from "@/lib/documents/tax-document-pdf";
import { dubaiDate } from "@/lib/messaging/templates/invoice";

export type CreditNotePdfSource = CreditNote & { readonly bookingReference: string };

const COPY = INVOICE_COPY.pdf;

export function creditNotePdfView(creditNote: CreditNotePdfSource): TaxDocumentView {
  const { refund } = creditNote;
  const reason = filled(creditNote.reason);

  return {
    kind: "credit_note",
    facts: {
      number: creditNote.creditNoteNumber,
      issuedOn: dubaiDate(creditNote.issuedAt),
      suppliedOn: filled(dubaiDate(creditNote.supplyDate)),
      bookingReference: creditNote.bookingReference,
      customerReference: filled(creditNote.customerReference),
      originalInvoice: { number: creditNote.invoiceNumber, issuedOn: dubaiDate(creditNote.invoiceIssuedAt) },
      paymentStatus: COPY.refunded,
    },
    issuer: pdfIssuer(creditNote.issuer),
    billTo: pdfBillTo(creditNote.billTo),
    lines: creditNote.lines.map((line, index) => ({
      key: `${line.kind}-${index}`,
      description: line.label,
      detail: null,
      quantity: String(line.quantity),
      unitPrice: formatAed(line.unitPriceFils),
      vatRate: line.vatRatePercent === null ? null : percent(line.vatRatePercent),
      vat: formatAed(line.vatFils),
      amount: formatAed(line.amountFils),
    })),
    totals: [
      {
        key: "excluding_vat",
        label: COPY.totalExcludingVat,
        value: formatAed(creditNote.amountFils - creditNote.taxFils),
        emphasis: false,
      },
      { key: "tax", label: vatTotalLabel(creditNote.tax), value: formatAed(creditNote.taxFils), emphasis: false },
      { key: "total", label: COPY.totalAed, value: formatAed(creditNote.amountFils), emphasis: true },
      { key: "credited", label: COPY.credited, value: formatAed(creditNote.amountFils), emphasis: false },
    ],
    payments: [
      {
        key: `${refund.reference}-0`,
        date: dubaiDate(refund.settledAt),
        method: paymentMethodLabel(refund.paymentMethod),
        reference: [refund.reference, filled(refund.paymentReference)].filter(Boolean).join(" / "),
        providerReference: filled(refund.providerReference),
        amount: formatAed(creditNote.amountFils),
      },
    ],
    notes: [INVOICE_COPY.currencyNote, ...(reason === null ? [] : [`${COPY.refundReason}: ${reason}`])],
    isTest: creditNote.isTest,
    voided:
      creditNote.voidedAt === null ? null : { on: dubaiDate(creditNote.voidedAt), reason: creditNote.voidReason },
  };
}

export function renderCreditNotePdf(creditNote: CreditNotePdfSource): Promise<Buffer> {
  return renderTaxDocumentPdf(creditNotePdfView(creditNote));
}
