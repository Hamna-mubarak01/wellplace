import { z } from "zod";

export const INVOICE_LINE_KINDS = ["visit", "addon", "overrun", "discount", "service_fee", "payment_on_account"] as const;
export type InvoiceLineKind = (typeof INVOICE_LINE_KINDS)[number];
export const INVOICE_STATES = ["issued", "voided"] as const;
export type InvoiceState = (typeof INVOICE_STATES)[number];
export const TAX_DOCUMENT_TYPES = ["invoice", "credit_note"] as const;
export type TaxDocumentType = (typeof TAX_DOCUMENT_TYPES)[number];

const lineSchema = z.object({
  kind: z.enum(INVOICE_LINE_KINDS),
  label: z.string(),
  quantity: z.number().int().nullable(),
  unit_price_fils: z.number().int().nullable(),
  amount_fils: z.number().int(),
  is_included: z.boolean(),
  is_taxable: z.boolean().optional(),
  minutes: z.number().int().nullable().optional(),
  adults: z.number().int().optional(),
  children: z.number().int().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  vat_rate_percent: z.number().nullable().optional(),
  tax_fils: z.number().int().nullable().optional(),
});

const issuerSchema = z.object({ legal_name: z.string(), trn: z.string(), address: z.string() });

const billToSchema = z.object({
  salutation: z.enum(["mr", "ms"]).nullable(),
  first_name: z.string(),
  last_name: z.string(),
  name: z.string(),
  email: z.string(),
  phone_e164: z.string(),
  company: z.string().nullable().optional(),
  trn: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

const taxSchema = z.object({ label: z.string(), rate_percent: z.number().nullable(), is_included: z.boolean() });

const paymentSnapshotSchema = z.object({
  payment_id: z.uuid(),
  number: z.string().nullable(),
  method: z.string(),
  provider_reference: z.string().nullable(),
  amount_fils: z.number().int(),
  tax_fils: z.number().int(),
  paid_at: z.string(),
  is_test: z.boolean(),
});

export const invoiceRowSchema = z.object({
  id: z.uuid(),
  invoice_number: z.string(),
  sequence_no: z.number().int(),
  booking_id: z.uuid(),
  customer_id: z.uuid(),
  issued_at: z.string(),
  issued_by: z.uuid().nullable(),
  issuer: issuerSchema,
  bill_to: billToSchema,
  lines: z.array(lineSchema),
  tax: taxSchema,
  subtotal_fils: z.number().int(),
  discount_fils: z.number().int(),
  addons_fils: z.number().int(),
  service_fee_fils: z.number().int(),
  tax_fils: z.number().int(),
  taxable_fils: z.number().int(),
  overrun_fils: z.number().int(),
  total_fils: z.number().int(),
  paid_fils: z.number().int(),
  currency: z.string(),
  voided_at: z.string().nullable(),
  voided_by: z.uuid().nullable(),
  void_reason: z.string().nullable(),
  is_test: z.boolean().optional(),
  supply_date: z.string().nullable().optional(),
  payments: z.array(paymentSnapshotSchema).optional(),
  replaces_invoice_id: z.uuid().nullable().optional(),
});

export const managedInvoiceRowSchema = invoiceRowSchema.extend({
  booking_reference: z.string(),
  suite_id: z.uuid().nullable(),
  suite_number: z.number().int().nullable(),
  customer_name: z.string(),
  customer_email: z.string(),
  issued_by_name: z.string().nullable(),
  voided_by_name: z.string().nullable(),
  state: z.enum(INVOICE_STATES),
  customer_reference: z.string().nullable().optional(),
  credited_fils: z.number().int().optional(),
});

export interface InvoiceLine {
  kind: InvoiceLineKind;
  label: string;
  quantity: number | null;
  unitPriceFils: number | null;
  amountFils: number;
  isIncluded: boolean;
  isTaxable: boolean | null;
  minutes: number | null;
  adults: number | null;
  children: number | null;
  startsAt: string | null;
  endsAt: string | null;
  vatRatePercent?: number | null;
  vatFils?: number | null;
}

export interface InvoicePayment {
  paymentId: string;
  reference: string | null;
  method: string;
  providerReference: string | null;
  amountFils: number;
  vatFils: number;
  paidAt: string;
  isTest: boolean;
}

export interface InvoiceIssuer {
  legalName: string;
  trn: string;
  address: string;
}

export interface InvoiceBillTo {
  salutation: "mr" | "ms" | null;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phoneE164: string;
  company?: string | null;
  trn?: string | null;
  address?: string | null;
}

export interface InvoiceTax {
  label: string;
  ratePercent: number | null;
  isIncluded: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  sequenceNo: number;
  bookingId: string;
  customerId: string;
  issuedAt: string;
  issuedBy: string | null;
  issuer: InvoiceIssuer;
  billTo: InvoiceBillTo;
  lines: InvoiceLine[];
  tax: InvoiceTax;
  subtotalFils: number;
  discountFils: number;
  addonsFils: number;
  serviceFeeFils: number;
  taxFils: number;
  taxableFils: number;
  overrunFils: number;
  totalFils: number;
  paidFils: number;
  currency: string;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  customerReference?: string | null;
  supplyDate?: string | null;
  isTest?: boolean;
  payments?: readonly InvoicePayment[];
  replacesInvoiceId?: string | null;
}

export interface ManagedInvoice extends Invoice {
  bookingReference: string;
  suiteId: string | null;
  suiteNumber: number | null;
  customerName: string;
  customerEmail: string;
  issuedByName: string | null;
  voidedByName: string | null;
  state: InvoiceState;
  creditedFils?: number;
}

function toIssuer(issuer: z.infer<typeof issuerSchema>): InvoiceIssuer {
  return { legalName: issuer.legal_name, trn: issuer.trn, address: issuer.address };
}

function toBillTo(billTo: z.infer<typeof billToSchema>): InvoiceBillTo {
  return {
    salutation: billTo.salutation,
    firstName: billTo.first_name,
    lastName: billTo.last_name,
    name: billTo.name,
    email: billTo.email,
    phoneE164: billTo.phone_e164,
    company: billTo.company ?? null,
    trn: billTo.trn ?? null,
    address: billTo.address ?? null,
  };
}

function toTax(tax: z.infer<typeof taxSchema>): InvoiceTax {
  return { label: tax.label, ratePercent: tax.rate_percent, isIncluded: tax.is_included };
}

export function toInvoice(row: z.infer<typeof invoiceRowSchema>): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    sequenceNo: row.sequence_no,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    issuedAt: row.issued_at,
    issuedBy: row.issued_by,
    issuer: toIssuer(row.issuer),
    billTo: toBillTo(row.bill_to),
    lines: row.lines.map((line) => ({
      kind: line.kind,
      label: line.label,
      quantity: line.quantity,
      unitPriceFils: line.unit_price_fils,
      amountFils: line.amount_fils,
      isIncluded: line.is_included,
      isTaxable: line.is_taxable ?? null,
      minutes: line.minutes ?? null,
      adults: line.adults ?? null,
      children: line.children ?? null,
      startsAt: line.starts_at ?? null,
      endsAt: line.ends_at ?? null,
      vatRatePercent: line.vat_rate_percent ?? null,
      vatFils: line.tax_fils ?? null,
    })),
    tax: toTax(row.tax),
    subtotalFils: row.subtotal_fils,
    discountFils: row.discount_fils,
    addonsFils: row.addons_fils,
    serviceFeeFils: row.service_fee_fils,
    taxFils: row.tax_fils,
    taxableFils: row.taxable_fils,
    overrunFils: row.overrun_fils,
    totalFils: row.total_fils,
    paidFils: row.paid_fils,
    currency: row.currency,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    voidReason: row.void_reason,
    customerReference: null,
    supplyDate: row.supply_date ?? null,
    isTest: row.is_test ?? false,
    payments: (row.payments ?? []).map((payment) => ({
      paymentId: payment.payment_id,
      reference: payment.number,
      method: payment.method,
      providerReference: payment.provider_reference,
      amountFils: payment.amount_fils,
      vatFils: payment.tax_fils,
      paidAt: payment.paid_at,
      isTest: payment.is_test,
    })),
    replacesInvoiceId: row.replaces_invoice_id ?? null,
  };
}

export function toManagedInvoice(row: z.infer<typeof managedInvoiceRowSchema>): ManagedInvoice {
  return {
    ...toInvoice(row),
    bookingReference: row.booking_reference,
    suiteId: row.suite_id,
    suiteNumber: row.suite_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    issuedByName: row.issued_by_name,
    voidedByName: row.voided_by_name,
    state: row.state,
    customerReference: row.customer_reference ?? null,
    creditedFils: row.credited_fils ?? 0,
  };
}

const creditNoteLineSchema = z.object({
  kind: z.literal("refund"),
  label: z.string(),
  quantity: z.number().int(),
  unit_price_fils: z.number().int(),
  amount_fils: z.number().int(),
  is_included: z.boolean(),
  is_taxable: z.boolean(),
  vat_rate_percent: z.number().nullable(),
  tax_fils: z.number().int(),
});

const creditNoteRefundSchema = z.object({
  refund_id: z.uuid(),
  number: z.string(),
  provider_reference: z.string().nullable(),
  requested_at: z.string(),
  settled_at: z.string(),
  payment_id: z.uuid(),
  payment_number: z.string().nullable(),
  payment_method: z.string(),
});

export const creditNoteRowSchema = z.object({
  id: z.uuid(),
  credit_note_number: z.string(),
  sequence_no: z.number().int(),
  invoice_id: z.uuid(),
  refund_id: z.uuid(),
  booking_id: z.uuid(),
  customer_id: z.uuid(),
  issued_at: z.string(),
  issued_by: z.uuid().nullable(),
  invoice_number: z.string(),
  invoice_issued_at: z.string(),
  supply_date: z.string(),
  issuer: issuerSchema,
  bill_to: billToSchema,
  tax: taxSchema,
  lines: z.array(creditNoteLineSchema),
  refund: creditNoteRefundSchema,
  reason: z.string(),
  amount_fils: z.number().int(),
  tax_fils: z.number().int(),
  taxable_fils: z.number().int(),
  currency: z.string(),
  is_test: z.boolean(),
  voided_at: z.string().nullable(),
  voided_by: z.uuid().nullable(),
  void_reason: z.string().nullable(),
});

export const managedCreditNoteRowSchema = creditNoteRowSchema.extend({
  booking_reference: z.string(),
  customer_reference: z.string().nullable(),
  customer_name: z.string(),
  customer_email: z.string(),
  issued_by_name: z.string().nullable(),
  voided_by_name: z.string().nullable(),
  state: z.enum(INVOICE_STATES),
});

export interface CreditNoteLine {
  kind: "refund";
  label: string;
  quantity: number;
  unitPriceFils: number;
  amountFils: number;
  isIncluded: boolean;
  isTaxable: boolean;
  vatRatePercent: number | null;
  vatFils: number;
}

export interface CreditNoteRefund {
  refundId: string;
  reference: string;
  providerReference: string | null;
  requestedAt: string;
  settledAt: string;
  paymentId: string;
  paymentReference: string | null;
  paymentMethod: string;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  sequenceNo: number;
  invoiceId: string;
  invoiceNumber: string;
  invoiceIssuedAt: string;
  refundId: string;
  bookingId: string;
  customerId: string;
  customerReference: string | null;
  issuedAt: string;
  issuedBy: string | null;
  supplyDate: string;
  issuer: InvoiceIssuer;
  billTo: InvoiceBillTo;
  tax: InvoiceTax;
  lines: CreditNoteLine[];
  refund: CreditNoteRefund;
  reason: string;
  amountFils: number;
  taxFils: number;
  taxableFils: number;
  currency: string;
  isTest: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
}

export interface ManagedCreditNote extends CreditNote {
  bookingReference: string;
  customerName: string;
  customerEmail: string;
  issuedByName: string | null;
  voidedByName: string | null;
  state: InvoiceState;
}

export function toCreditNote(row: z.infer<typeof creditNoteRowSchema>): CreditNote {
  return {
    id: row.id,
    creditNoteNumber: row.credit_note_number,
    sequenceNo: row.sequence_no,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    invoiceIssuedAt: row.invoice_issued_at,
    refundId: row.refund_id,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    customerReference: null,
    issuedAt: row.issued_at,
    issuedBy: row.issued_by,
    supplyDate: row.supply_date,
    issuer: toIssuer(row.issuer),
    billTo: toBillTo(row.bill_to),
    tax: toTax(row.tax),
    lines: row.lines.map((line) => ({
      kind: line.kind,
      label: line.label,
      quantity: line.quantity,
      unitPriceFils: line.unit_price_fils,
      amountFils: line.amount_fils,
      isIncluded: line.is_included,
      isTaxable: line.is_taxable,
      vatRatePercent: line.vat_rate_percent,
      vatFils: line.tax_fils,
    })),
    refund: {
      refundId: row.refund.refund_id,
      reference: row.refund.number,
      providerReference: row.refund.provider_reference,
      requestedAt: row.refund.requested_at,
      settledAt: row.refund.settled_at,
      paymentId: row.refund.payment_id,
      paymentReference: row.refund.payment_number,
      paymentMethod: row.refund.payment_method,
    },
    reason: row.reason,
    amountFils: row.amount_fils,
    taxFils: row.tax_fils,
    taxableFils: row.taxable_fils,
    currency: row.currency,
    isTest: row.is_test,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    voidReason: row.void_reason,
  };
}

export function toManagedCreditNote(row: z.infer<typeof managedCreditNoteRowSchema>): ManagedCreditNote {
  return {
    ...toCreditNote(row),
    customerReference: row.customer_reference,
    bookingReference: row.booking_reference,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    issuedByName: row.issued_by_name,
    voidedByName: row.voided_by_name,
    state: row.state,
  };
}

export const guestDocumentSummarySchema = z.object({
  id: z.uuid(),
  type: z.enum(TAX_DOCUMENT_TYPES),
  number: z.string(),
  issuedAt: z.string(),
  totalFils: z.number().int(),
  taxFils: z.number().int(),
  currency: z.string(),
  isTest: z.boolean(),
  invoiceNumber: z.string().nullable(),
});
export type GuestDocumentSummary = z.infer<typeof guestDocumentSummarySchema>;

const guestTaxDocumentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("invoice"),
    bookingReference: z.string(),
    customerReference: z.string(),
    document: invoiceRowSchema,
  }),
  z.object({
    type: z.literal("credit_note"),
    bookingReference: z.string(),
    customerReference: z.string(),
    document: creditNoteRowSchema,
  }),
]);

export type GuestTaxDocument =
  | { type: "invoice"; bookingReference: string; invoice: Invoice }
  | { type: "credit_note"; bookingReference: string; creditNote: CreditNote };

export function parseGuestTaxDocument(data: unknown): GuestTaxDocument | null {
  const parsed = guestTaxDocumentSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[invoices] unexpected guest document:", parsed.error.issues[0]?.message);
    return null;
  }
  if (parsed.data.type === "invoice") {
    return {
      type: "invoice",
      bookingReference: parsed.data.bookingReference,
      invoice: { ...toInvoice(parsed.data.document), customerReference: parsed.data.customerReference },
    };
  }
  return {
    type: "credit_note",
    bookingReference: parsed.data.bookingReference,
    creditNote: { ...toCreditNote(parsed.data.document), customerReference: parsed.data.customerReference },
  };
}
