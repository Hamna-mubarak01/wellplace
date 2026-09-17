import type { EmailFooterDesign } from "@/lib/domain/email/footer";
import type { EmailHeaderDesign } from "@/lib/domain/email/header";
import { footerFor } from "@/lib/config/message-email-frame";
import { formatAed } from "@/components/shared/money";
import { BOOKING_MESSAGE_COPY } from "@/lib/config/booking-messages";
import { emailConfig, formatSender } from "@/lib/config/email";
import { INVOICE_COPY, INVOICE_MESSAGE_KEY } from "@/lib/config/invoice";
import { DUBAI_TIME_ZONE, formatDubaiDateTime, formatDubaiTime } from "@/lib/domain/time";
import { EMAIL_FONTS, EMAIL_THEME as T } from "@/lib/messaging/email-theme";
import { escapeHtml, renderEmail, type EmailBlock } from "@/lib/messaging/templates/layout";
import type { EmailMessage } from "@/lib/messaging/types";

export type InvoiceSourceLineKind = "visit" | "addon" | "overrun" | "discount" | "service_fee" | "payment_on_account";

export interface InvoiceSourceLine {
  readonly kind: InvoiceSourceLineKind;
  readonly label: string;
  readonly quantity: number | null;
  readonly unitPriceFils: number | null;
  readonly amountFils: number;
  readonly isIncluded: boolean;
  readonly adults: number | null;
  readonly children: number | null;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly vatRatePercent?: number | null;
  readonly vatFils?: number | null;
}

export interface InvoiceSourcePayment {
  readonly reference: string | null;
  readonly method: string;
  readonly providerReference: string | null;
  readonly amountFils: number;
  readonly paidAt: string;
  readonly vatFils?: number;
}

export interface InvoiceDocumentSource {
  readonly invoiceNumber: string;
  readonly issuedAt: string;
  readonly bookingReference: string;
  readonly supplyDate?: string | null;
  readonly isTest?: boolean;
  readonly payments?: readonly InvoiceSourcePayment[];
  readonly issuer: { readonly legalName: string; readonly trn: string; readonly address: string };
  readonly billTo: {
    readonly firstName: string;
    readonly name: string;
    readonly email: string;
    readonly phoneE164: string;
    readonly company?: string | null;
    readonly trn?: string | null;
    readonly address?: string | null;
  };
  readonly lines: readonly InvoiceSourceLine[];
  readonly tax: { readonly label: string; readonly ratePercent: number | null; readonly isIncluded: boolean };
  readonly subtotalFils: number;
  readonly discountFils: number;
  readonly addonsFils: number;
  readonly serviceFeeFils: number;
  readonly taxFils: number;
  readonly taxableFils: number;
  readonly overrunFils: number;
  readonly totalFils: number;
  readonly paidFils: number;
  readonly voidedAt: string | null;
  readonly voidReason: string | null;
}

export interface InvoiceDocumentField {
  readonly label: string;
  readonly value: string;
}

export interface InvoiceDocumentLine {
  readonly key: string;
  readonly description: string;
  readonly detail: string | null;
  readonly quantity: string | null;
  readonly unitPrice: string | null;
  readonly vatRate: string | null;
  readonly vat: string | null;
  readonly amount: string;
}

export interface InvoiceDocumentPayment {
  readonly key: string;
  readonly date: string;
  readonly method: string;
  readonly reference: string | null;
  readonly providerReference: string | null;
  readonly amount: string;
}

export interface InvoiceDocumentTotal {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly emphasis: boolean;
}

export interface InvoiceDocument {
  readonly title: string;
  readonly tradingName: string;
  readonly number: string;
  readonly bookingReference: string;
  readonly facts: readonly InvoiceDocumentField[];
  readonly issuer: {
    readonly legalName: string;
    readonly trn: string;
    readonly addressLines: readonly string[];
  };
  readonly billTo: {
    readonly firstName: string;
    readonly name: string;
    readonly email: string;
    readonly phone: string;
    readonly company: string | null;
    readonly trn: string | null;
    readonly addressLines: readonly string[];
  };
  readonly lines: readonly InvoiceDocumentLine[];
  readonly totals: readonly InvoiceDocumentTotal[];
  readonly payments: readonly InvoiceDocumentPayment[];
  readonly testNotice: string | null;
  readonly currencyNote: string;
  readonly voided: { readonly on: string; readonly reason: string | null } | null;
}

const LABEL = INVOICE_COPY.labels;
const PDF_LABEL = INVOICE_COPY.pdf;
const METHOD_LABEL = new Map<string, string>(Object.entries(PDF_LABEL.paymentMethods));

export function paymentMethodLabel(method: string): string {
  return METHOD_LABEL.get(method) ?? method;
}

function textLines(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

const DUBAI_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function dubaiDate(instant: string): string {
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? "" : DUBAI_DATE.format(date);
}

function party(adults: number | null, children: number | null): string | null {
  if (adults === null && children === null) return null;
  const grown = adults ?? 0;
  const young = children ?? 0;
  const adultsText = `${grown} ${grown === 1 ? "adult" : "adults"}`;
  if (young === 0) return adultsText;
  return `${adultsText}, ${young} ${young === 1 ? "child" : "children"}`;
}

function visitWindow(line: InvoiceSourceLine | undefined): string | null {
  if (!line?.startsAt || !line.endsAt) return null;
  const start = formatDubaiDateTime(line.startsAt);
  const end = formatDubaiTime(line.endsAt);
  return start && end ? `${start} to ${end}` : null;
}

export function formatRate(percent: number): string {
  return percent.toLocaleString("en-AE", { maximumFractionDigits: 2 });
}

export function invoiceTaxLabel(tax: InvoiceDocumentSource["tax"]): string {
  const rate = tax.ratePercent === null ? "" : ` (${formatRate(tax.ratePercent)}%)`;
  return `${tax.label}${rate}${tax.isIncluded ? " included" : ""}`;
}

export function invoiceTaxableFils(source: Pick<InvoiceDocumentSource, "taxableFils">): number {
  return source.taxableFils;
}

function lineVat(line: InvoiceSourceLine): Pick<InvoiceDocumentLine, "vatRate" | "vat"> {
  const rate = line.vatRatePercent ?? null;
  const vat = line.vatFils ?? null;
  return { vatRate: rate === null ? null : `${formatRate(rate)}%`, vat: vat === null ? null : formatAed(vat) };
}

function documentLine(line: InvoiceSourceLine, index: number): InvoiceDocumentLine {
  const key = `${line.kind}-${index}`;
  const vat = lineVat(line);
  switch (line.kind) {
    case "visit":
      return {
        key,
        description: line.label,
        detail: party(line.adults, line.children),
        quantity: null,
        unitPrice: null,
        ...vat,
        amount: formatAed(line.amountFils),
      };
    case "addon":
      return {
        key,
        description: line.label,
        detail: null,
        quantity: line.quantity === null ? null : String(line.quantity),
        unitPrice: line.unitPriceFils === null || line.isIncluded ? null : formatAed(line.unitPriceFils),
        ...vat,
        amount: line.isIncluded ? LABEL.included : formatAed(line.amountFils),
      };
    case "overrun":
    case "discount":
    case "service_fee":
    case "payment_on_account":
      return {
        key,
        description: line.label,
        detail: null,
        quantity: line.quantity === null ? null : String(line.quantity),
        unitPrice: line.unitPriceFils === null ? null : formatAed(line.unitPriceFils),
        ...vat,
        amount: formatAed(line.amountFils),
      };
  }
}

function documentPayment(payment: InvoiceSourcePayment, index: number): InvoiceDocumentPayment {
  return {
    key: `${payment.reference ?? "payment"}-${index}`,
    date: dubaiDate(payment.paidAt),
    method: paymentMethodLabel(payment.method),
    reference: present(payment.reference),
    providerReference: present(payment.providerReference),
    amount: formatAed(payment.amountFils),
  };
}

function documentTotals(source: InvoiceDocumentSource): InvoiceDocumentTotal[] {
  const feeLabel = source.lines.find((line) => line.kind === "service_fee")?.label ?? LABEL.serviceFee;
  const overrun = source.lines.find((line) => line.kind === "overrun");
  const taxRow: InvoiceDocumentTotal = {
    key: "tax",
    label: invoiceTaxLabel(source.tax),
    value: formatAed(source.taxFils),
    emphasis: false,
  };
  const rows: (InvoiceDocumentTotal | null)[] = [
    { key: "subtotal", label: LABEL.subtotal, value: formatAed(source.subtotalFils + source.addonsFils), emphasis: false },
    source.discountFils > 0
      ? { key: "discount", label: LABEL.discount, value: formatAed(-source.discountFils), emphasis: false }
      : null,
    source.serviceFeeFils > 0
      ? { key: "service_fee", label: feeLabel, value: formatAed(source.serviceFeeFils), emphasis: false }
      : null,
    source.overrunFils > 0 && overrun !== undefined
      ? { key: "overrun", label: overrun.label, value: formatAed(source.overrunFils), emphasis: false }
      : null,
    source.tax.isIncluded ? null : taxRow,
    { key: "total", label: LABEL.total, value: formatAed(source.totalFils), emphasis: true },
    source.tax.isIncluded ? taxRow : null,
    { key: "taxable", label: LABEL.taxable, value: formatAed(invoiceTaxableFils(source)), emphasis: false },
    { key: "paid", label: LABEL.paid, value: formatAed(source.paidFils), emphasis: false },
  ];
  return rows.filter((row): row is InvoiceDocumentTotal => row !== null);
}

export function invoiceDocument(source: InvoiceDocumentSource): InvoiceDocument {
  const visit = visitWindow(source.lines.find((line) => line.kind === "visit"));
  const supplied = present(source.supplyDate) === null ? null : present(dubaiDate(source.supplyDate ?? ""));
  const facts: InvoiceDocumentField[] = [
    { label: LABEL.number, value: source.invoiceNumber },
    { label: LABEL.issued, value: dubaiDate(source.issuedAt) },
    ...(supplied === null ? [] : [{ label: PDF_LABEL.supplied, value: supplied }]),
    { label: LABEL.booking, value: source.bookingReference },
    ...(visit === null ? [] : [{ label: LABEL.visit, value: visit }]),
  ];

  return {
    title: INVOICE_COPY.documentTitle,
    tradingName: INVOICE_COPY.tradingName,
    number: source.invoiceNumber,
    bookingReference: source.bookingReference,
    facts,
    issuer: {
      legalName: source.issuer.legalName,
      trn: source.issuer.trn,
      addressLines: source.issuer.address
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    },
    billTo: {
      firstName: source.billTo.firstName.trim(),
      name: source.billTo.name,
      email: source.billTo.email,
      phone: source.billTo.phoneE164,
      company: present(source.billTo.company),
      trn: present(source.billTo.trn),
      addressLines: textLines(source.billTo.address),
    },
    lines: source.lines.map(documentLine),
    totals: documentTotals(source),
    payments: (source.payments ?? []).map(documentPayment),
    testNotice: source.isTest ? PDF_LABEL.testBanner : null,
    currencyNote: INVOICE_COPY.currencyNote,
    voided: source.voidedAt === null ? null : { on: dubaiDate(source.voidedAt), reason: source.voidReason },
  };
}

function cell(tag: "td" | "th", text: string, className = ""): string {
  return `<${tag}${className ? ` class="${className}"` : ""}>${escapeHtml(text)}</${tag}>`;
}

function field(label: string, value: string): string {
  return `<div class="field"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

const DOCUMENT_STYLE = `
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: ${T.pageBackground}; color: ${T.textPrimary}; font: 15px/1.5 ${EMAIL_FONTS.body}; }
  .sheet { max-width: 52rem; margin: 2rem auto; padding: 2.5rem; background: ${T.cardBackground}; border: 1px solid ${T.border}; border-radius: 14px; }
  .head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid ${T.border}; }
  .brand { margin: 0 0 0.25rem; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: ${T.textMuted}; }
  h1 { margin: 0; font: 700 30px/38px ${EMAIL_FONTS.display}; }
  h2 { margin: 0 0 0.5rem; font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: ${T.textMuted}; }
  dl { margin: 0; display: grid; gap: 0.5rem; }
  .field { display: grid; grid-template-columns: 9rem 1fr; gap: 1rem; }
  dt { color: ${T.textMuted}; }
  dd { margin: 0; font-family: ${EMAIL_FONTS.data}; }
  .void { margin: 1.5rem 0 0; padding: 0.75rem 1rem; border: 1px solid ${T.borderStrong}; border-radius: 10px; background: ${T.panelBackground}; font-weight: 600; }
  .parties { display: flex; flex-wrap: wrap; gap: 2rem; padding: 1.5rem 0; border-bottom: 1px solid ${T.border}; }
  .parties > div { flex: 1 1 16rem; }
  .parties p { margin: 0; }
  .data { font-family: ${EMAIL_FONTS.data}; }
  table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
  th { text-align: left; font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: ${T.textMuted}; padding: 0 0 0.5rem; border-bottom: 1px solid ${T.border}; }
  td { padding: 0.75rem 0; border-bottom: 1px solid ${T.border}; vertical-align: top; }
  .num { text-align: right; font-family: ${EMAIL_FONTS.data}; white-space: nowrap; padding-left: 1rem; }
  .detail { display: block; color: ${T.textSecondary}; font-size: 13px; }
  .totals { width: auto; margin-left: auto; min-width: 20rem; }
  .totals td { border-bottom: 0; padding: 0.35rem 0; }
  .totals .strong td { font-weight: 700; border-top: 1px solid ${T.borderStrong}; padding-top: 0.75rem; }
  .note { margin: 2rem 0 0; color: ${T.textMuted}; font-size: 13px; }
  .section { margin: 2rem 0 0; }
  @media print { body { background: none; } .sheet { margin: 0; border: 0; border-radius: 0; padding: 0; max-width: none; } }
`;

export function renderInvoiceDocumentHtml(document: InvoiceDocument): string {
  const facts = document.facts.map((fact) => field(fact.label, fact.value)).join("");
  const voided = document.voided
    ? `<p class="void">${escapeHtml(
        [
          INVOICE_COPY.voidStamp,
          `${LABEL.voidedOn} ${document.voided.on}`,
          document.voided.reason ? `${LABEL.voidReason}: ${document.voided.reason}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      )}</p>`
    : "";
  const issuer = [
    `<p><strong>${escapeHtml(document.issuer.legalName)}</strong></p>`,
    `<p class="data">${escapeHtml(`${LABEL.trn} ${document.issuer.trn}`)}</p>`,
    ...document.issuer.addressLines.map((line) => `<p>${escapeHtml(line)}</p>`),
  ].join("");
  const billTo = [
    `<p><strong>${escapeHtml(document.billTo.name)}</strong></p>`,
    document.billTo.company ? `<p>${escapeHtml(document.billTo.company)}</p>` : "",
    document.billTo.trn ? `<p class="data">${escapeHtml(`${LABEL.trn} ${document.billTo.trn}`)}</p>` : "",
    ...document.billTo.addressLines.map((line) => `<p>${escapeHtml(line)}</p>`),
    `<p>${escapeHtml(document.billTo.email)}</p>`,
    `<p class="data">${escapeHtml(document.billTo.phone)}</p>`,
  ].join("");
  const testNotice = document.testNotice ? `<p class="void">${escapeHtml(document.testNotice)}</p>` : "";
  const lines = document.lines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.description)}${line.detail ? `<span class="detail">${escapeHtml(line.detail)}</span>` : ""}</td>${cell("td", line.quantity ?? "", "num")}${cell("td", line.unitPrice ?? "", "num")}${cell("td", line.vatRate ?? "", "num")}${cell("td", line.vat ?? "", "num")}${cell("td", line.amount, "num")}</tr>`,
    )
    .join("");
  const payments =
    document.payments.length === 0
      ? ""
      : `<h2 class="section">${escapeHtml(PDF_LABEL.payments)}</h2><table><thead><tr>${cell("th", PDF_LABEL.paidOn)}${cell("th", PDF_LABEL.method)}${cell("th", PDF_LABEL.paymentNumber)}${cell("th", PDF_LABEL.providerReference)}${cell("th", LABEL.amount, "num")}</tr></thead><tbody>${document.payments
          .map(
            (payment) =>
              `<tr>${cell("td", payment.date)}${cell("td", payment.method)}${cell("td", payment.reference ?? "", "data")}${cell("td", payment.providerReference ?? "", "data")}${cell("td", payment.amount, "num")}</tr>`,
          )
          .join("")}</tbody></table>`;
  const totals = document.totals
    .map(
      (total) =>
        `<tr${total.emphasis ? ' class="strong"' : ""}>${cell("td", total.label)}${cell("td", total.value, "num")}</tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(`${document.title} ${document.number}`)}</title>
<style>${DOCUMENT_STYLE}</style>
</head>
<body>
<main class="sheet">
<header class="head">
<div><p class="brand">${escapeHtml(document.tradingName)}</p><h1>${escapeHtml(document.title)}</h1></div>
<dl>${facts}</dl>
</header>
${testNotice}
${voided}
<section class="parties">
<div><h2>${escapeHtml(LABEL.issuer)}</h2>${issuer}</div>
<div><h2>${escapeHtml(LABEL.billTo)}</h2>${billTo}</div>
</section>
<table>
<thead><tr>${cell("th", LABEL.description)}${cell("th", LABEL.quantity, "num")}${cell("th", LABEL.unitPrice, "num")}${cell("th", PDF_LABEL.vatRate, "num")}${cell("th", PDF_LABEL.vat, "num")}${cell("th", LABEL.amount, "num")}</tr></thead>
<tbody>${lines}</tbody>
</table>
<table class="totals"><tbody>${totals}</tbody></table>
${payments}
<p class="note">${escapeHtml(document.currencyNote)}</p>
</main>
</body>
</html>`;
}

function emailLineLabel(line: InvoiceDocumentLine): string {
  const quantity = line.quantity === null ? "" : ` × ${line.quantity}`;
  const detail = line.detail === null ? "" : ` (${line.detail})`;
  return `${line.description}${quantity}${detail}`;
}

export interface InvoiceRecipient {
  readonly email: string;
  readonly firstName: string;
}

export function invoiceEmail(document: InvoiceDocument, recipient: InvoiceRecipient, frame?: { footer?: string | null; footerDesign?: EmailFooterDesign | null; headerDesign?: EmailHeaderDesign | null; branding?: boolean }): EmailMessage {
  const config = emailConfig();
  const copy = INVOICE_COPY.email;
  const subject = copy.subject.replace("{number}", document.number);
  const name = recipient.firstName.trim();
  const heading = name ? copy.heading.replace("{name}", name) : copy.heading.replace(", {name}", "");

  const blocks: EmailBlock[] = [
    { kind: "eyebrow", text: copy.eyebrow },
    { kind: "heading", text: heading },
    { kind: "lead", text: copy.lead.replace("{reference}", document.bookingReference) },
    { kind: "panel", rows: document.facts },
    {
      kind: "panel",
      rows: [
        { label: LABEL.issuer, value: document.issuer.legalName },
        { label: LABEL.trn, value: document.issuer.trn },
        { label: LABEL.address, value: document.issuer.addressLines.join(", ") },
      ],
    },
    {
      kind: "panel",
      rows: [
        { label: LABEL.billTo, value: document.billTo.name },
        ...(document.billTo.company ? [{ label: LABEL.company, value: document.billTo.company }] : []),
        ...(document.billTo.trn ? [{ label: LABEL.trn, value: document.billTo.trn }] : []),
        { label: LABEL.email, value: document.billTo.email },
        { label: LABEL.phone, value: document.billTo.phone },
      ],
    },
    { kind: "panel", rows: document.lines.map((line) => ({ label: emailLineLabel(line), value: line.amount })) },
    { kind: "panel", rows: document.totals.map((total) => ({ label: total.label, value: total.value })) },
    { kind: "note", text: document.currencyNote },
    { kind: "note", text: copy.note },
  ];

  const { html, text, attachments } = renderEmail({
    subject,
    preheader: copy.preheader,
    assetBaseUrl: config.assetBaseUrl,
    footerDesign: frame?.footerDesign ?? undefined,
    headerDesign: frame?.headerDesign ?? undefined,
    footerLines: frame?.footer != null ? footerFor("invoice_issued", frame.footer) : BOOKING_MESSAGE_COPY.footer,
    branding: frame?.branding,
    blocks,
  });

  return {
    to: recipient.email,
    from: formatSender(config.guestFromName, config.guestFrom),
    replyTo: config.guestFrom,
    subject,
    text,
    html,
    attachments,
    kind: "transactional",
    reference: `${INVOICE_MESSAGE_KEY}-${document.number}`,
  };
}

export interface CreditNoteEmailSource {
  readonly creditNoteNumber: string;
  readonly issuedAt: string;
  readonly bookingReference: string;
  readonly invoiceNumber: string;
  readonly reason: string;
  readonly amountFils: number;
  readonly taxFils: number;
  readonly tax: { readonly label: string; readonly ratePercent: number | null; readonly isIncluded: boolean };
  readonly refund: { readonly reference: string };
}

export function creditNoteEmail(
  source: CreditNoteEmailSource,
  recipient: InvoiceRecipient,
  frame?: { footer?: string | null; footerDesign?: EmailFooterDesign | null; headerDesign?: EmailHeaderDesign | null; branding?: boolean },
): EmailMessage {
  const config = emailConfig();
  const copy = INVOICE_COPY.creditNoteEmail;
  const subject = copy.subject.replace("{number}", source.creditNoteNumber);
  const name = recipient.firstName.trim();
  const heading = name ? copy.heading.replace("{name}", name) : copy.heading.replace(", {name}", "");

  const blocks: EmailBlock[] = [
    { kind: "eyebrow", text: copy.eyebrow },
    { kind: "heading", text: heading },
    {
      kind: "lead",
      text: copy.lead.replace("{reference}", source.bookingReference).replace("{invoice}", source.invoiceNumber),
    },
    {
      kind: "panel",
      rows: [
        { label: copy.number, value: source.creditNoteNumber },
        { label: copy.issued, value: dubaiDate(source.issuedAt) },
        { label: copy.booking, value: source.bookingReference },
        { label: copy.invoice, value: source.invoiceNumber },
        { label: copy.refund, value: source.refund.reference },
        { label: copy.reason, value: source.reason },
      ],
    },
    {
      kind: "panel",
      rows: [
        { label: copy.amount, value: formatAed(source.amountFils) },
        { label: invoiceTaxLabel(source.tax), value: formatAed(source.taxFils) },
      ],
    },
    { kind: "note", text: INVOICE_COPY.currencyNote },
    { kind: "note", text: copy.note },
  ];

  const { html, text, attachments } = renderEmail({
    subject,
    preheader: copy.preheader,
    assetBaseUrl: config.assetBaseUrl,
    footerDesign: frame?.footerDesign ?? undefined,
    headerDesign: frame?.headerDesign ?? undefined,
    footerLines: frame?.footer != null ? footerFor(INVOICE_MESSAGE_KEY, frame.footer) : BOOKING_MESSAGE_COPY.footer,
    branding: frame?.branding,
    blocks,
  });

  return {
    to: recipient.email,
    from: formatSender(config.guestFromName, config.guestFrom),
    replyTo: config.guestFrom,
    subject,
    text,
    html,
    attachments,
    kind: "transactional",
    reference: `${INVOICE_MESSAGE_KEY}-${source.creditNoteNumber}`,
  };
}
