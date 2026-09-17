import { SETTINGS, type SettingKey } from "@/lib/config/registry";

export const INVOICE_MESSAGE_KEY = "invoice_issued";

export const INVOICE_SETTING_KEY = {
  legalName: "invoice.issuer_legal_name",
  trn: "invoice.issuer_trn",
  address: "invoice.issuer_address",
  prefix: "invoice.number_prefix",
} as const satisfies Readonly<Record<string, SettingKey>>;

export const INVOICE_SETTING_KEYS: readonly SettingKey[] = [
  INVOICE_SETTING_KEY.legalName,
  INVOICE_SETTING_KEY.trn,
  INVOICE_SETTING_KEY.address,
  INVOICE_SETTING_KEY.prefix,
];

export const INVOICE_ISSUER_FIELDS = ["legalName", "trn", "address"] as const;

export type InvoiceIssuerField = (typeof INVOICE_ISSUER_FIELDS)[number];

const TRN_PATTERN = /^\d{15}$/;
const PREFIX_PATTERN = /^[A-Z0-9]{1,12}$/;
const TRN_SEPARATORS = /[\s-]/g;

export const CUSTOMER_TRN_PATTERN = TRN_PATTERN;
export const CUSTOMER_TRN_SEPARATORS = TRN_SEPARATORS;

export const INVOICE_SEND = { maxRecipients: 5 } as const;

export const WHATSAPP_E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export const INVOICE_BILL_TO_LIMITS = { name: 200, company: 200, address: 500 } as const;

const ISSUER_FIELD_LABEL: Readonly<Record<InvoiceIssuerField, string>> = {
  legalName: "legal name",
  trn: "TRN",
  address: "address",
};

export const INVOICE_COPY = {
  documentTitle: "Tax invoice",
  tradingName: "WellPlace",
  voidStamp: "Void",
  currencyNote: "All amounts are in UAE dirhams (AED).",
  labels: {
    number: "Invoice number",
    issued: "Date of issue",
    booking: "Booking reference",
    visit: "Visit",
    guests: "Guests",
    issuer: "Issued by",
    trn: "TRN",
    address: "Address",
    billTo: "Billed to",
    company: "Company",
    email: "Email",
    phone: "Phone",
    description: "Description",
    quantity: "Qty",
    unitPrice: "Unit price",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    serviceFee: "Service fee",
    total: "Total",
    taxable: "Taxable amount",
    paid: "Amount paid",
    included: "Included",
    voidedOn: "Voided on",
    voidReason: "Reason",
  },
  email: {
    subject: "Your WellPlace tax invoice {number}",
    preheader: "Your tax invoice for your WellPlace visit.",
    eyebrow: "Tax invoice",
    heading: "Your tax invoice, {name}",
    lead: "Thank you for visiting WellPlace. Your tax invoice for booking {reference} is attached as a PDF, with a summary below.",
    note: "The attached PDF is your tax invoice. Keep it for your records.",
  },
  creditNoteEmail: {
    subject: "Your WellPlace tax credit note {number}",
    preheader: "Your tax credit note for your WellPlace booking.",
    eyebrow: "Tax credit note",
    heading: "Your tax credit note, {name}",
    lead: "Your tax credit note for booking {reference} is attached as a PDF, with a summary below. It credits invoice {invoice}.",
    note: "The attached PDF is your tax credit note. Keep it for your records.",
    number: "Credit note number",
    issued: "Date of issue",
    booking: "Booking reference",
    invoice: "Original invoice",
    refund: "Refund reference",
    reason: "Reason for credit",
    amount: "Amount credited",
  },
  whatsapp: {
    invoiceCaption: "Your WellPlace tax invoice {number}",
    creditNoteCaption: "Your WellPlace tax credit note {number}",
  },
  pdf: {
    invoiceTitle: "Tax Invoice",
    creditNoteTitle: "Tax Credit Note",
    supplied: "Date of supply",
    customer: "Customer number",
    originalInvoice: "Original invoice",
    originalInvoiceDate: "Original invoice date",
    paymentStatus: "Payment status",
    vatRate: "VAT rate",
    vat: "VAT",
    totalExcludingVat: "Total excluding VAT",
    totalAed: "Total (AED)",
    credited: "Amount credited",
    payments: "Payments",
    refunds: "Refunds",
    paidOn: "Date",
    method: "Method",
    paymentNumber: "Reference",
    providerReference: "Provider reference",
    refundReason: "Reason for credit",
    testBanner: "Test — no money charged. Not a tax invoice.",
    paid: "Paid",
    partiallyPaid: "Partially paid",
    unpaid: "Not paid",
    refunded: "Refunded",
    paymentMethods: {
      cash: "Cash",
      card_terminal: "Card terminal",
      payment_link: "Payment link",
      online: "Online",
      complimentary: "Complimentary",
    },
  },
  console: {
    downloadPdf: "Download PDF",
    issuerIncomplete:
      "Invoices cannot be issued until WellPlace’s legal name, TRN and address are entered in Settings.",
    openSettings: "Enter invoice details",
    issueFailed: "No invoice was issued.",
    emailNotFound: "This invoice could not be found. Refresh the list; it may have been voided by a colleague.",
    emailVoided: "This invoice has been voided, so it cannot be sent. Issue a new invoice for the booking and send that one.",
    emailUnavailable: "This invoice could not be loaded, so nothing was sent. Refresh the page and try again.",
    emailNotSent:
      "The email could not be sent. Check the customer’s email address and try again. You can also download the invoice and send it yourself.",
    creditNoteNotFound: "This credit note could not be found. Refresh the list and try again.",
    creditNoteVoided: "This credit note has been voided, so it cannot be sent.",
    whatsappNotReady: "WhatsApp is not connected yet.",
    whatsappNotSent: "The WhatsApp message could not be sent. Check the numbers and try again, or send the PDF by email.",
    tooManyRecipients: "Send to {max} recipients or fewer.",
    noRecipients: "Add at least one recipient.",
    invalidEmail: "Enter a valid email address for every recipient.",
    invalidPhone: "Enter a valid mobile number, with its country code, for every recipient.",
    duplicateRecipient: "Each recipient can be added only once.",
    regenerateHint: "The current invoice and its credit notes are voided and replaced by a new invoice with the next number.",
    trnInvalid: "Enter the customer’s tax registration number as 15 digits, or leave it empty.",
    nameRequired: "Enter the name to bill.",
    hasCreditNotes: "This invoice has credit notes, so it cannot be voided on its own. Regenerate it instead.",
    regenerateFailed: "The invoice was not regenerated.",
  },
  documentTypes: {
    invoice: "Invoice",
    credit_note: "Credit note",
  },
  missingReasons: {
    payment_not_invoiced: "Payment not invoiced",
    refund_not_credited: "Refund without a credit note",
    invoice_exceeds_payments: "Invoice exceeds its payments — regenerate it",
  },
  csv: {
    columns: [
      "Type",
      "Number",
      "Issued (Dubai)",
      "Date of supply",
      "Booking",
      "Customer number",
      "Customer",
      "Company",
      "Customer TRN",
      "Excluding VAT (AED)",
      "VAT (AED)",
      "Total (AED)",
      "Currency",
      "State",
      "Test",
      "Original invoice",
      "Void reason",
    ],
    filename: "wellplace-tax-documents-{date}.csv",
  },
  settings: {
    trnHint: "Enter all 15 digits of the tax registration number.",
    prefixHint: "Use 1 to 12 letters or numbers. Leave it empty to use {default}.",
    trnInvalid: "Enter all 15 digits of the tax registration number, with no letters.",
    prefixInvalid: "Use only letters and numbers in the invoice number prefix, up to 12 characters.",
    ready: "Invoices can be issued with these details.",
    notReady: "Invoices cannot be issued until {missing} {verb} entered.",
    numberExample: "New invoices are numbered like {example}.",
  },
} as const;

export const INVOICE_SEQUENCE_DIGITS = 6;

function filled(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export const INVOICE_DEFAULT_PREFIX: string = SETTINGS[INVOICE_SETTING_KEY.prefix].defaultValue;

export function invoiceNumberPrefix(values: Readonly<Record<string, unknown>>): string {
  return (filled(values[INVOICE_SETTING_KEY.prefix]) ?? INVOICE_DEFAULT_PREFIX).toUpperCase();
}

export function invoicePrefixHint(): string {
  return INVOICE_COPY.settings.prefixHint.replace("{default}", INVOICE_DEFAULT_PREFIX);
}

export interface InvoiceIssuerReadiness {
  readonly ready: boolean;
  readonly missing: readonly InvoiceIssuerField[];
  readonly legalName: string | null;
  readonly trn: string | null;
  readonly address: string | null;
  readonly prefix: string;
  readonly prefixValid: boolean;
}

export function invoiceIssuerReadiness(values: Readonly<Record<string, unknown>>): InvoiceIssuerReadiness {
  const legalName = filled(values[INVOICE_SETTING_KEY.legalName]);
  const suppliedTrn = filled(values[INVOICE_SETTING_KEY.trn]);
  const trn = suppliedTrn !== null && TRN_PATTERN.test(suppliedTrn) ? suppliedTrn : null;
  const address = filled(values[INVOICE_SETTING_KEY.address]);
  const prefix = invoiceNumberPrefix(values);
  const prefixValid = PREFIX_PATTERN.test(prefix);
  const present: Readonly<Record<InvoiceIssuerField, boolean>> = {
    legalName: legalName !== null,
    trn: trn !== null,
    address: address !== null,
  };
  const missing = INVOICE_ISSUER_FIELDS.filter((field) => !present[field]);

  return { ready: missing.length === 0 && prefixValid, missing, legalName, trn, address, prefix, prefixValid };
}

export function describeMissingIssuerDetails(missing: readonly InvoiceIssuerField[]): string {
  const labels = missing.map((field) => ISSUER_FIELD_LABEL[field]);
  if (labels.length === 0) return "";
  if (labels.length === 1) return `the ${labels[0]}`;
  return `the ${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function invoiceReadinessMessage(readiness: InvoiceIssuerReadiness): string {
  if (readiness.ready) return INVOICE_COPY.settings.ready;
  if (readiness.missing.length === 0) return INVOICE_COPY.settings.prefixInvalid;
  return INVOICE_COPY.settings.notReady
    .replace("{missing}", describeMissingIssuerDetails(readiness.missing))
    .replace("{verb}", readiness.missing.length === 1 ? "is" : "are");
}

export function invoiceNumberExample(prefix: string, year: string): string {
  return INVOICE_COPY.settings.numberExample.replace(
    "{example}",
    `${prefix}-${year}-${"1".padStart(INVOICE_SEQUENCE_DIGITS, "0")}`,
  );
}

export function invoiceSettingsProblem(values: Readonly<Record<string, unknown>>): string | null {
  const trn = filled(values[INVOICE_SETTING_KEY.trn]);
  if (trn !== null && !TRN_PATTERN.test(trn)) return INVOICE_COPY.settings.trnInvalid;
  const prefix = filled(values[INVOICE_SETTING_KEY.prefix]);
  if (prefix !== null && !PREFIX_PATTERN.test(prefix.toUpperCase())) return INVOICE_COPY.settings.prefixInvalid;
  return null;
}

export function invoiceSettingInput(key: SettingKey, raw: string): string | null {
  if (key === INVOICE_SETTING_KEY.trn) return filled(raw.replace(TRN_SEPARATORS, ""));
  if (key === INVOICE_SETTING_KEY.prefix) return filled(raw)?.toUpperCase() ?? null;
  return raw.trim() === "" ? null : raw;
}

export function isInvoiceSettingKey(key: string): boolean {
  return INVOICE_SETTING_KEYS.some((candidate) => candidate === key);
}
