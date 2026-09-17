import { formatAed } from "@/components/shared/money";
import { INVOICE_COPY } from "@/lib/config/invoice";
import type {
  TaxDocumentBillTo,
  TaxDocumentIssuer,
  TaxDocumentLine,
  TaxDocumentPayment,
  TaxDocumentTotal,
  TaxDocumentView,
} from "@/lib/documents/tax-document-pdf";
import {
  dubaiDate,
  invoiceDocument,
  formatRate,
  paymentMethodLabel,
  type InvoiceDocument,
  type InvoiceDocumentLine,
  type InvoiceDocumentSource,
  type InvoiceSourceLine,
} from "@/lib/messaging/templates/invoice";

export interface InvoicePdfPayment {
  readonly reference: string | null;
  readonly method: string;
  readonly providerReference: string | null;
  readonly amountFils: number;
  readonly paidAt: string;
}

export interface InvoicePdfLine extends InvoiceSourceLine {
  readonly vatRatePercent?: number | null;
  readonly vatFils?: number | null;
}

export interface InvoicePdfSource extends InvoiceDocumentSource {
  readonly customerReference?: string | null;
  readonly supplyDate?: string | null;
  readonly isTest?: boolean;
  readonly billTo: InvoiceDocumentSource["billTo"] & {
    readonly company?: string | null;
    readonly trn?: string | null;
    readonly address?: string | null;
  };
  readonly lines: readonly InvoicePdfLine[];
  readonly payments?: readonly InvoicePdfPayment[];
}

export { paymentMethodLabel };

const COPY = INVOICE_COPY.pdf;
const CARRIED_TOTALS = ["subtotal", "discount", "service_fee", "overrun"] as const;

export function filled(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function splitLines(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function percent(value: number): string {
  return `${formatRate(value)}%`;
}

export function pdfIssuer(issuer: InvoicePdfSource["issuer"]): TaxDocumentIssuer {
  return { legalName: issuer.legalName, trn: issuer.trn, addressLines: splitLines(issuer.address) };
}

export function pdfBillTo(billTo: InvoicePdfSource["billTo"]): TaxDocumentBillTo {
  return {
    name: billTo.name,
    company: filled(billTo.company),
    trn: filled(billTo.trn),
    addressLines: splitLines(billTo.address),
    email: filled(billTo.email),
    phone: filled(billTo.phoneE164),
  };
}

export function vatTotalLabel(tax: InvoicePdfSource["tax"]): string {
  return tax.ratePercent === null ? tax.label : `${tax.label} (${percent(tax.ratePercent)})`;
}

function pdfLine(line: InvoiceDocumentLine, origin: InvoicePdfLine | undefined): TaxDocumentLine {
  const rate = origin?.vatRatePercent ?? null;
  const vat = origin?.vatFils ?? null;
  return { ...line, vatRate: rate === null ? null : percent(rate), vat: vat === null ? null : formatAed(vat) };
}

function paymentStatus(source: InvoicePdfSource): string {
  if (source.paidFils >= source.totalFils) return COPY.paid;
  return source.paidFils > 0 ? COPY.partiallyPaid : COPY.unpaid;
}

function pdfTotals(source: InvoicePdfSource, document: InvoiceDocument): TaxDocumentTotal[] {
  const carried = CARRIED_TOTALS.map((key) => document.totals.find((total) => total.key === key)).filter(
    (total): total is TaxDocumentTotal => total !== undefined,
  );
  const vatLabel = vatTotalLabel(source.tax);
  const paid = document.totals.find((total) => total.key === "paid");

  return [
    ...carried,
    { key: "excluding_vat", label: COPY.totalExcludingVat, value: formatAed(source.totalFils - source.taxFils), emphasis: false },
    { key: "tax", label: vatLabel, value: formatAed(source.taxFils), emphasis: false },
    { key: "total", label: COPY.totalAed, value: formatAed(source.totalFils), emphasis: true },
    ...(paid === undefined ? [] : [paid]),
  ];
}

function pdfPayment(payment: InvoicePdfPayment, index: number): TaxDocumentPayment {
  return {
    key: `${payment.reference ?? "payment"}-${index}`,
    date: dubaiDate(payment.paidAt),
    method: paymentMethodLabel(payment.method),
    reference: filled(payment.reference),
    providerReference: filled(payment.providerReference),
    amount: formatAed(payment.amountFils),
  };
}

export function invoicePdfView(source: InvoicePdfSource): TaxDocumentView {
  const document = invoiceDocument(source);
  const supply = filled(source.supplyDate) ?? source.lines.find((line) => line.kind === "visit")?.startsAt ?? null;

  return {
    kind: "invoice",
    facts: {
      number: document.number,
      issuedOn: dubaiDate(source.issuedAt),
      suppliedOn: supply === null ? null : filled(dubaiDate(supply)),
      bookingReference: document.bookingReference,
      customerReference: filled(source.customerReference),
      originalInvoice: null,
      paymentStatus: paymentStatus(source),
    },
    issuer: pdfIssuer(source.issuer),
    billTo: pdfBillTo(source.billTo),
    lines: document.lines.map((line, index) => pdfLine(line, source.lines[index])),
    totals: pdfTotals(source, document),
    payments: (source.payments ?? []).map(pdfPayment),
    notes: [document.currencyNote],
    isTest: source.isTest ?? false,
    voided: document.voided,
  };
}
