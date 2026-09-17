import { formatDubaiDateTime } from "@/lib/domain/time";
import type { StaffRole, StaffRow } from "@/lib/db/queries/staff";

export const STAFF_CSV_COLUMNS = [
  "Name",
  "Email",
  "Role",
  "Access",
  "Added (Dubai)",
] as const;

const ROLE_LABEL: Readonly<Record<StaffRole, string>> = {
  management: "Management",
  reception: "Reception",
};

export function staffExportRow(member: StaffRow): string[] {
  return [
    member.fullName,
    member.email,
    ROLE_LABEL[member.role],
    member.isActive ? "Active" : "Deactivated",
    formatDubaiDateTime(member.createdAt),
  ];
}

function field(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `\t${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function staffCsvRow(member: StaffRow): string {
  return staffExportRow(member).map(field).join(",");
}

export function staffCsv(members: readonly StaffRow[]): string {
  return `﻿${[
    STAFF_CSV_COLUMNS.map(field).join(","),
    ...members.map(staffCsvRow),
  ].join("\r\n")}\r\n`;
}

export function staffCsvFilename(now: Date, scope: "all" | "filtered"): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return `wellplace-staff-${scope}-${day}.csv`;
}

export function staffXlsxFilename(
  now: Date,
  scope: "all" | "filtered",
): string {
  return staffCsvFilename(now, scope).replace(/\.csv$/, ".xlsx");
}
