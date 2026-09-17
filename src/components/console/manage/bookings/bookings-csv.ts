import type { ManagementBookingRow } from "@/lib/db/queries/management-bookings";
import { formatDubaiDateTime } from "@/lib/domain/time";
import {
  bookingStatusLabel,
  paymentStatusLabel,
  resolveDisplayStatus,
  sourceLabel,
  suiteLabel,
  visitMinutes,
} from "@/components/console/manage/bookings/booking-model";

export const BOOKINGS_CSV_COLUMNS = [
  "Reference",
  "Created (Dubai)",
  "Customer",
  "Email",
  "Mobile",
  "Suite",
  "Visit starts (Dubai)",
  "Visit ends (Dubai)",
  "Length (minutes)",
  "Adults",
  "Children",
  "Status",
  "Payment",
  "Source",
  "Total (AED)",
  "Complimentary",
] as const;

function aed(fils: number): string {
  const sign = fils < 0 ? "-" : "";
  const abs = Math.abs(Math.round(fils));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `\t${value}` : value;
  return /[",\n\r\t]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function bookingExportRow(row: ManagementBookingRow): string[] {
  return [
    row.reference,
    formatDubaiDateTime(row.createdAt),
    row.guestName,
    row.guestEmail,
    row.guestPhone,
    suiteLabel(row.suiteNumber),
    formatDubaiDateTime(row.startsAt),
    formatDubaiDateTime(row.endsAt),
    String(visitMinutes(row.startsAt, row.endsAt)),
    String(row.adults),
    String(row.children),
    bookingStatusLabel(resolveDisplayStatus(row.status, row.displayStatus)),
    paymentStatusLabel(row.paymentStatus),
    sourceLabel(row.source),
    aed(row.totalFils),
    row.isComplimentary ? "Yes" : "No",
  ];
}

const BYTE_ORDER_MARK = "\uFEFF";

export function bookingsCsv(rows: readonly ManagementBookingRow[]): string {
  return `${BYTE_ORDER_MARK}${[
    BOOKINGS_CSV_COLUMNS.map(csvField).join(","),
    ...rows.map((row) => bookingExportRow(row).map(csvField).join(",")),
  ].join("\r\n")}\r\n`;
}

export function bookingsCsvFilename(now: Date, filtered: boolean): string {
  const stamp = formatDubaiDateTime(now).replace(/[^0-9A-Za-z]+/g, "-").replace(/-+$/, "");
  return `wellplace-bookings-${filtered ? "filtered" : "all"}-${stamp}.csv`;
}
