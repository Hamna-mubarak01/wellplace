import { readFile } from "node:fs/promises";
import path from "node:path";

import { Document, Font, Image as PdfImage, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { emailConfig } from "@/lib/config/email";
import { PUBLIC_BRAND, VENUE_ADDRESS_LINES } from "@/lib/config/entity";
import { INVOICE_COPY } from "@/lib/config/invoice";
import { EMAIL_THEME as T } from "@/lib/messaging/email-theme";

export type TaxDocumentKind = "invoice" | "credit_note";

export interface TaxDocumentFacts {
  readonly number: string;
  readonly issuedOn: string;
  readonly suppliedOn: string | null;
  readonly bookingReference: string;
  readonly customerReference: string | null;
  readonly originalInvoice: { readonly number: string; readonly issuedOn: string } | null;
  readonly paymentStatus: string | null;
}

export interface TaxDocumentIssuer {
  readonly legalName: string;
  readonly trn: string;
  readonly addressLines: readonly string[];
}

export interface TaxDocumentBillTo {
  readonly name: string;
  readonly company: string | null;
  readonly trn: string | null;
  readonly addressLines: readonly string[];
  readonly email: string | null;
  readonly phone: string | null;
}

export interface TaxDocumentLine {
  readonly key: string;
  readonly description: string;
  readonly detail: string | null;
  readonly quantity: string | null;
  readonly unitPrice: string | null;
  readonly vatRate: string | null;
  readonly vat: string | null;
  readonly amount: string;
}

export interface TaxDocumentTotal {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly emphasis: boolean;
}

export interface TaxDocumentPayment {
  readonly key: string;
  readonly date: string;
  readonly method: string;
  readonly reference: string | null;
  readonly providerReference: string | null;
  readonly amount: string;
}

export interface TaxDocumentView {
  readonly kind: TaxDocumentKind;
  readonly facts: TaxDocumentFacts;
  readonly issuer: TaxDocumentIssuer;
  readonly billTo: TaxDocumentBillTo;
  readonly lines: readonly TaxDocumentLine[];
  readonly totals: readonly TaxDocumentTotal[];
  readonly payments: readonly TaxDocumentPayment[];
  readonly notes: readonly string[];
  readonly isTest: boolean;
  readonly voided: { readonly on: string; readonly reason: string | null } | null;
}

Font.registerHyphenationCallback((word) => [word]);

const COPY = INVOICE_COPY.pdf;
const LABEL = INVOICE_COPY.labels;
const REGULAR = "Helvetica";
const BOLD = "Helvetica-Bold";
const LOGO_FILE = path.join(process.cwd(), "public/brand/wordmark-dark-email.png");
const LOGO_WIDTH = 120;
const LOGO_HEIGHT = (LOGO_WIDTH * 65) / 336;
const PAGE_MARGIN = 40;
const FOOTER_BOTTOM = 26;

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_MARGIN,
    paddingBottom: 80,
    paddingHorizontal: PAGE_MARGIN,
    fontFamily: REGULAR,
    fontSize: 9,
    lineHeight: 1.4,
    color: T.textPrimary,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
  wordmark: { fontFamily: BOLD, fontSize: 18, color: T.textPrimary },
  titleBlock: { alignItems: "flex-end", maxWidth: 300 },
  title: { fontFamily: BOLD, fontSize: 20, lineHeight: 1.2 },
  number: { marginTop: 2, fontSize: 10, color: T.textSecondary },
  accent: { marginTop: 14, height: 2, backgroundColor: T.brand },
  banner: {
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: T.brand,
    borderRadius: 6,
    backgroundColor: T.brandWash,
    fontFamily: BOLD,
    fontSize: 10,
    textAlign: "center",
  },
  voidNote: {
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: T.borderStrong,
    borderRadius: 6,
    backgroundColor: T.panelBackground,
  },
  voidStamp: {
    position: "absolute",
    top: 360,
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: BOLD,
    fontSize: 120,
    color: T.borderStrong,
    opacity: 0.35,
    transform: "rotate(-30deg)",
  },
  facts: { flexDirection: "row", flexWrap: "wrap", marginTop: 16 },
  fact: { width: "25%", paddingRight: 8, marginBottom: 10 },
  label: { marginBottom: 2, fontSize: 7, letterSpacing: 0.6, textTransform: "uppercase", color: T.textMuted },
  factValue: { fontFamily: BOLD },
  parties: {
    flexDirection: "row",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: T.border,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  party: { width: "50%", paddingRight: 16 },
  partyName: { fontFamily: BOLD, fontSize: 10 },
  table: { marginTop: 16 },
  headRow: { flexDirection: "row", paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: T.borderStrong },
  headCell: { fontSize: 7, letterSpacing: 0.6, textTransform: "uppercase", color: T.textMuted },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: T.border },
  grow: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingRight: 8 },
  detail: { fontSize: 8, color: T.textSecondary },
  num: { paddingLeft: 6, textAlign: "right" },
  qty: { width: 30 },
  unitPrice: { width: 68 },
  vatRate: { width: 48 },
  vat: { width: 62 },
  amount: { width: 80 },
  payDate: { width: 88, paddingRight: 6 },
  payMethod: { width: 76, paddingRight: 6 },
  payNumber: { width: 72, paddingRight: 6 },
  totals: { marginTop: 12, marginLeft: "auto", width: 250 },
  totalRow: { flexDirection: "row", paddingVertical: 3 },
  totalRowEmphasis: { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: T.borderStrong },
  totalLabel: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingRight: 8, color: T.textSecondary },
  totalValue: { textAlign: "right" },
  totalTextEmphasis: { fontFamily: BOLD, fontSize: 11, color: T.textPrimary },
  section: { marginTop: 20 },
  sectionHeading: { marginBottom: 4, fontFamily: BOLD, fontSize: 10 },
  notes: { marginTop: 20, fontSize: 8, color: T.textMuted },
  footerRule: {
    position: "absolute",
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
    bottom: FOOTER_BOTTOM + 30,
    height: 1,
    backgroundColor: T.border,
  },
  footerText: {
    position: "absolute",
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
    bottom: FOOTER_BOTTOM,
    fontSize: 7,
    color: T.textMuted,
  },
});

interface FactCell {
  readonly label: string;
  readonly value: string;
}

function pdfText(value: string): string {
  return value.replace(/−/g, "-");
}

export function taxDocumentTitle(kind: TaxDocumentKind): string {
  return kind === "credit_note" ? COPY.creditNoteTitle : COPY.invoiceTitle;
}

export function taxDocumentPdfFilename(documentNumber: string): string {
  return `${documentNumber.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
}

function factCells(view: TaxDocumentView): FactCell[] {
  const { facts } = view;
  const cells: (FactCell | null)[] = [
    { label: LABEL.issued, value: facts.issuedOn },
    facts.suppliedOn === null ? null : { label: COPY.supplied, value: facts.suppliedOn },
    facts.originalInvoice === null ? null : { label: COPY.originalInvoice, value: facts.originalInvoice.number },
    facts.originalInvoice === null ? null : { label: COPY.originalInvoiceDate, value: facts.originalInvoice.issuedOn },
    { label: LABEL.booking, value: facts.bookingReference },
    facts.customerReference === null ? null : { label: COPY.customer, value: facts.customerReference },
    facts.paymentStatus === null ? null : { label: COPY.paymentStatus, value: facts.paymentStatus },
  ];
  return cells.filter((cell): cell is FactCell => cell !== null);
}

function voidLine(voided: NonNullable<TaxDocumentView["voided"]>): string {
  return [INVOICE_COPY.voidStamp, `${LABEL.voidedOn} ${voided.on}`, voided.reason ? `${LABEL.voidReason}: ${voided.reason}` : ""]
    .filter(Boolean)
    .join(" · ");
}

function footerLine(): string {
  return [PUBLIC_BRAND, VENUE_ADDRESS_LINES.join(", "), emailConfig().guestFrom].join(" · ");
}

function Party({ heading, name, lines }: { readonly heading: string; readonly name: string; readonly lines: readonly string[] }) {
  return (
    <View style={styles.party}>
      <Text style={styles.label}>{heading}</Text>
      <Text style={styles.partyName}>{pdfText(name)}</Text>
      {lines.map((line, index) => (
        <Text key={`${index}-${line}`}>{pdfText(line)}</Text>
      ))}
    </View>
  );
}

function TaxDocument({ view, logo }: { readonly view: TaxDocumentView; readonly logo: Buffer | null }) {
  const title = taxDocumentTitle(view.kind);
  const showVat = view.lines.some((line) => line.vatRate !== null || line.vat !== null);
  const issuerLines = [`${LABEL.trn} ${view.issuer.trn}`, ...view.issuer.addressLines];
  const billToLines = [
    view.billTo.company,
    view.billTo.trn === null ? null : `${LABEL.trn} ${view.billTo.trn}`,
    ...view.billTo.addressLines,
    view.billTo.email,
    view.billTo.phone,
  ].filter((line): line is string => line !== null);

  return (
    <Document title={`${title} ${view.facts.number}`} author={PUBLIC_BRAND} creator={PUBLIC_BRAND} producer={PUBLIC_BRAND}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logo === null ? (
            <Text style={styles.wordmark}>{PUBLIC_BRAND}</Text>
          ) : (
            <PdfImage src={{ data: logo, format: "png" }} style={styles.logo} />
          )}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.number}>{view.facts.number}</Text>
          </View>
        </View>
        <View style={styles.accent} />

        {view.isTest && <Text style={styles.banner}>{COPY.testBanner}</Text>}
        {view.voided !== null && <Text style={styles.voidNote}>{pdfText(voidLine(view.voided))}</Text>}

        <View style={styles.facts}>
          {factCells(view).map((cell) => (
            <View key={cell.label} style={styles.fact}>
              <Text style={styles.label}>{cell.label}</Text>
              <Text style={styles.factValue}>{pdfText(cell.value)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.parties}>
          <Party heading={LABEL.issuer} name={view.issuer.legalName} lines={issuerLines} />
          <Party heading={LABEL.billTo} name={view.billTo.name} lines={billToLines} />
        </View>

        <View style={styles.table}>
          <View style={styles.headRow} minPresenceAhead={48}>
            <Text style={[styles.headCell, styles.grow]}>{LABEL.description}</Text>
            <Text style={[styles.headCell, styles.num, styles.qty]}>{LABEL.quantity}</Text>
            <Text style={[styles.headCell, styles.num, styles.unitPrice]}>{LABEL.unitPrice}</Text>
            {showVat && <Text style={[styles.headCell, styles.num, styles.vatRate]}>{COPY.vatRate}</Text>}
            {showVat && <Text style={[styles.headCell, styles.num, styles.vat]}>{COPY.vat}</Text>}
            <Text style={[styles.headCell, styles.num, styles.amount]}>{LABEL.amount}</Text>
          </View>
          {view.lines.map((line) => (
            <View key={line.key} style={styles.row} wrap={false}>
              <View style={styles.grow}>
                <Text>{pdfText(line.description)}</Text>
                {line.detail !== null && <Text style={styles.detail}>{pdfText(line.detail)}</Text>}
              </View>
              <Text style={[styles.num, styles.qty]}>{line.quantity ?? ""}</Text>
              <Text style={[styles.num, styles.unitPrice]}>{pdfText(line.unitPrice ?? "")}</Text>
              {showVat && <Text style={[styles.num, styles.vatRate]}>{line.vatRate ?? ""}</Text>}
              {showVat && <Text style={[styles.num, styles.vat]}>{pdfText(line.vat ?? "")}</Text>}
              <Text style={[styles.num, styles.amount]}>{pdfText(line.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals} wrap={false}>
          {view.totals.map((total) => (
            <View key={total.key} style={total.emphasis ? [styles.totalRow, styles.totalRowEmphasis] : styles.totalRow}>
              <Text style={total.emphasis ? [styles.totalLabel, styles.totalTextEmphasis] : styles.totalLabel}>
                {pdfText(total.label)}
              </Text>
              <Text style={total.emphasis ? [styles.totalValue, styles.totalTextEmphasis] : styles.totalValue}>
                {pdfText(total.value)}
              </Text>
            </View>
          ))}
        </View>

        {view.payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading} minPresenceAhead={48}>
              {view.kind === "credit_note" ? COPY.refunds : COPY.payments}
            </Text>
            <View style={styles.headRow}>
              <Text style={[styles.headCell, styles.payDate]}>{COPY.paidOn}</Text>
              <Text style={[styles.headCell, styles.payMethod]}>{COPY.method}</Text>
              <Text style={[styles.headCell, styles.payNumber]}>{COPY.paymentNumber}</Text>
              <Text style={[styles.headCell, styles.grow]}>{COPY.providerReference}</Text>
              <Text style={[styles.headCell, styles.num, styles.amount]}>{LABEL.amount}</Text>
            </View>
            {view.payments.map((payment) => (
              <View key={payment.key} style={styles.row} wrap={false}>
                <Text style={styles.payDate}>{payment.date}</Text>
                <Text style={styles.payMethod}>{pdfText(payment.method)}</Text>
                <Text style={styles.payNumber}>{payment.reference ?? ""}</Text>
                <Text style={styles.grow}>{payment.providerReference ?? ""}</Text>
                <Text style={[styles.num, styles.amount]}>{pdfText(payment.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {view.notes.length > 0 && (
          <View style={styles.notes} wrap={false}>
            {view.notes.map((note, index) => (
              <Text key={`${index}-${note}`}>{pdfText(note)}</Text>
            ))}
          </View>
        )}

        <View style={styles.footerRule} fixed />
        <Text style={styles.footerText} fixed>
          {pdfText(footerLine())}
        </Text>

        {view.voided !== null && (
          <Text style={styles.voidStamp} fixed>
            {INVOICE_COPY.voidStamp.toUpperCase()}
          </Text>
        )}
      </Page>
    </Document>
  );
}

export async function loadDocumentLogo(): Promise<Buffer | null> {
  try {
    return await readFile(LOGO_FILE);
  } catch (cause) {
    console.error(
      "[documents] the WellPlace logo could not be read, so the text wordmark is used:",
      cause instanceof Error ? cause.message : cause,
    );
    return null;
  }
}

export async function renderTaxDocumentPdf(view: TaxDocumentView): Promise<Buffer> {
  return renderToBuffer(<TaxDocument view={view} logo={await loadDocumentLogo()} />);
}
