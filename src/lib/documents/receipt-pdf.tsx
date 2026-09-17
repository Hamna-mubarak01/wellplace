import { Document, Font, Image as PdfImage, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { PUBLIC_BRAND, VENUE_ADDRESS_LINES } from "@/lib/config/entity";
import type { ReceiptRow, ReceiptView } from "@/lib/documents/receipt-view";
import { loadDocumentLogo } from "@/lib/documents/tax-document-pdf";
import { EMAIL_THEME as T } from "@/lib/messaging/email-theme";

Font.registerHyphenationCallback((word) => [word]);

const REGULAR = "Helvetica";
const BOLD = "Helvetica-Bold";
const LOGO_WIDTH = 120;
const LOGO_HEIGHT = (LOGO_WIDTH * 65) / 336;
const PAGE_MARGIN = 40;

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_MARGIN,
    paddingBottom: 72,
    paddingHorizontal: PAGE_MARGIN,
    fontFamily: REGULAR,
    fontSize: 10,
    lineHeight: 1.45,
    color: T.textPrimary,
    backgroundColor: T.cardBackground,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
  wordmark: { fontFamily: BOLD, fontSize: 18 },
  reference: { fontSize: 9, color: T.textSecondary, letterSpacing: 0.6, textTransform: "uppercase" },
  hero: { marginTop: 22, padding: 18, borderRadius: 10, backgroundColor: T.brandWash },
  eyebrow: { fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", color: T.brand },
  heading: { marginTop: 4, fontFamily: BOLD, fontSize: 20, lineHeight: 1.2 },
  heroMeta: { marginTop: 6, color: T.textSecondary },
  banner: {
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: T.borderStrong,
    borderRadius: 6,
    backgroundColor: T.panelBackground,
    fontSize: 9,
  },
  columns: { flexDirection: "row", marginTop: 18 },
  column: { width: "50%", paddingRight: 14 },
  sectionHeading: { marginBottom: 6, fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", color: T.textMuted },
  fact: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: T.border },
  factLabel: { width: 96, color: T.textSecondary },
  factValue: { flexGrow: 1, flexShrink: 1, flexBasis: 0, fontFamily: BOLD },
  section: { marginTop: 20 },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: T.border },
  rowLabel: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingRight: 8 },
  rowValue: { textAlign: "right" },
  totals: { marginTop: 10, marginLeft: "auto", width: 260 },
  totalRow: { flexDirection: "row", paddingVertical: 3 },
  totalLabel: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingRight: 8, color: T.textSecondary },
  totalValue: { textAlign: "right" },
  struck: { textDecoration: "line-through", color: T.textMuted },
  emphasisRow: { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: T.borderStrong },
  emphasisText: { fontFamily: BOLD, fontSize: 12, color: T.textPrimary },
  footer: {
    position: "absolute",
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
    bottom: 28,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: T.border,
    fontSize: 8,
    color: T.textMuted,
  },
});

function pdfText(value: string): string {
  return value.replace(/[−–]/g, "-");
}

function Facts({ heading, rows }: { readonly heading: string; readonly rows: readonly ReceiptRow[] }) {
  return (
    <View style={styles.column}>
      <Text style={styles.sectionHeading}>{heading}</Text>
      {rows.map((row) => (
        <View key={row.key} style={styles.fact} wrap={false}>
          <Text style={styles.factLabel}>{pdfText(row.label)}</Text>
          <Text style={styles.factValue}>{pdfText(row.value)}</Text>
        </View>
      ))}
    </View>
  );
}

function Receipt({ view, logo }: { readonly view: ReceiptView; readonly logo: Buffer | null }) {
  return (
    <Document title={`${PUBLIC_BRAND} receipt ${view.reference}`} author={PUBLIC_BRAND} creator={PUBLIC_BRAND} producer={PUBLIC_BRAND}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logo === null ? (
            <Text style={styles.wordmark}>{PUBLIC_BRAND}</Text>
          ) : (
            <PdfImage src={{ data: logo, format: "png" }} style={styles.logo} />
          )}
          <Text style={styles.reference}>Receipt · {view.reference}</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Booking {view.reference}</Text>
          <Text style={styles.heading}>{pdfText(view.heading)}</Text>
          <Text style={styles.heroMeta}>{pdfText(`${view.visitDate} · ${view.visitTime} (Dubai time)`)}</Text>
        </View>

        {view.notice !== null && <Text style={styles.banner}>{pdfText(view.notice)}</Text>}

        <View style={styles.columns}>
          <Facts heading="Your visit" rows={view.visit} />
          <Facts
            heading="Guest and payment"
            rows={[
              { key: "name", label: "Name", value: view.guestName },
              { key: "email", label: "Email", value: view.email },
              ...view.payment,
            ]}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Price</Text>
          {view.lines.map((line) => (
            <View key={line.key} style={styles.row} wrap={false}>
              <Text style={styles.rowLabel}>{pdfText(line.label)}</Text>
              <Text style={styles.rowValue}>{pdfText(line.value)}</Text>
            </View>
          ))}
          <View style={styles.totals} wrap={false}>
            {view.totals.map((total) => (
              <View key={total.key} style={total.emphasis ? [styles.totalRow, styles.emphasisRow] : styles.totalRow}>
                <Text style={total.emphasis ? [styles.totalLabel, styles.emphasisText] : styles.totalLabel}>{pdfText(total.label)}</Text>
                <Text
                  style={
                    total.emphasis
                      ? [styles.totalValue, styles.emphasisText]
                      : total.struck
                        ? [styles.totalValue, styles.struck]
                        : styles.totalValue
                  }
                >
                  {pdfText(total.value)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {view.refunds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Refunds</Text>
            {view.refunds.map((refund) => (
              <View key={refund.key} style={styles.row} wrap={false}>
                <Text style={styles.rowLabel}>{pdfText(refund.label)}</Text>
                <Text style={styles.rowValue}>{pdfText(refund.value)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer} fixed>
          {pdfText(
            [
              PUBLIC_BRAND,
              VENUE_ADDRESS_LINES.join(", "),
              view.simulated ? "Test payment: no money was charged. This receipt is not a tax invoice." : "This receipt is not a tax invoice.",
            ].join(" · "),
          )}
        </Text>
      </Page>
    </Document>
  );
}

export function receiptPdfFilename(reference: string): string {
  return `${PUBLIC_BRAND}-${reference.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
}

export async function renderReceiptPdf(view: ReceiptView): Promise<Buffer> {
  return renderToBuffer(<Receipt view={view} logo={await loadDocumentLogo()} />);
}
