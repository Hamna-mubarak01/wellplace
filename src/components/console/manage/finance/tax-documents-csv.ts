import { csvField } from "@/components/console/manage/bookings/bookings-csv";
import { INVOICE_COPY } from "@/lib/config/invoice";
import type { TaxDocumentCsvRow } from "@/lib/db/queries/invoices";
import { formatDubaiDateTime, todayInDubai } from "@/lib/domain/time";

const BYTE_ORDER_MARK = "\uFEFF";

export function aedAmount(fils: number): string {
  const sign = fils < 0 ? "-" : "";
  const whole = Math.abs(Math.round(fils));
  return `${sign}${Math.floor(whole / 100)}.${String(whole % 100).padStart(2, "0")}`;
}

export function taxDocumentCsvRow(row: TaxDocumentCsvRow): string[] {
  return [
    INVOICE_COPY.documentTypes[row.documentType],
    row.number,
    formatDubaiDateTime(row.issuedAt),
    row.supplyDate === null ? "" : todayInDubai(new Date(row.supplyDate)),
    row.bookingReference,
    row.customerReference ?? "",
    row.customerName,
    row.billToCompany ?? "",
    row.billToTrn ?? "",
    aedAmount(row.taxableFils),
    aedAmount(row.taxFils),
    aedAmount(row.totalFils),
    row.currency,
    row.state === "voided" ? "Void" : "Valid",
    row.isTest ? "Yes" : "No",
    row.originalInvoiceNumber ?? "",
    row.voidReason ?? "",
  ];
}

export function taxDocumentsCsv(rows: readonly TaxDocumentCsvRow[]): string {
  return `${BYTE_ORDER_MARK}${[
    INVOICE_COPY.csv.columns.map(csvField).join(","),
    ...rows.map((row) => taxDocumentCsvRow(row).map(csvField).join(",")),
  ].join("\r\n")}\r\n`;
}

export function taxDocumentsCsvFilename(now: Date): string {
  return INVOICE_COPY.csv.filename.replace("{date}", todayInDubai(now));
}
