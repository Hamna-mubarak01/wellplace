import type { WaitlistLead } from "@/lib/db/queries/waitlist-leads";
import { formatDubaiDateTime } from "@/lib/domain/time";

export const WAITLIST_CSV_COLUMNS = [
  "Salutation",
  "First name",
  "Last name",
  "Email",
  "Mobile",
  "Country",
  "Date of birth",
  "Age",
  "Signups",
  "Arrived via",
  "Campaign",
  "Joined (Dubai)",
  "Marketing status",
  "Consent timestamp (Dubai)",
  "Accepted wording",
  "Terms version",
  "Referrer",
  "UTM source",
  "UTM medium",
  "UTM campaign",
  "UTM content",
  "UTM term",
  "Status",
  "Archived",
] as const;

const SALUTATIONS: Record<string, string> = { mr: "Mr.", ms: "Ms." };

export function waitlistExportRow(
  lead: WaitlistLead,
): (string | number | null | undefined)[] {
  return [
    lead.salutation ? (SALUTATIONS[lead.salutation] ?? lead.salutation) : "",
    lead.firstName,
    lead.lastName,
    lead.email,
    lead.phoneE164,
    lead.phoneCountry,
    lead.dateOfBirth?.split("-").reverse().join("-") ?? "",
    lead.ageYears,
    lead.signupCount,
    lead.source ?? "Direct",
    lead.utmCampaign,
    formatDubaiDateTime(lead.createdAt),
    lead.marketingGranted === true ? "Subscribed" : lead.marketingGranted === false ? "Withdrawn" : "Not recorded",
    lead.marketingConsentAt ? formatDubaiDateTime(lead.marketingConsentAt) : "",
    lead.termsAcceptanceText,
    lead.termsAcceptanceVersion,
    lead.referrer,
    lead.utmSource,
    lead.utmMedium,
    lead.utmCampaign,
    lead.utmContent,
    lead.utmTerm,
    lead.archivedAt ? "Archived" : "Active",
    lead.archivedAt ? formatDubaiDateTime(lead.archivedAt) : "",
  ];
}

function field(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";

  const raw = String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `\t${raw}` : raw;

  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function waitlistCsvRow(lead: WaitlistLead): string {
  return waitlistExportRow(lead).map(field).join(",");
}

export function waitlistCsv(rows: readonly WaitlistLead[]): string {
  const lines = [
    WAITLIST_CSV_COLUMNS.map(field).join(","),
    ...rows.map(waitlistCsvRow),
  ];

  return `﻿${lines.join("\r\n")}\r\n`;
}

export function waitlistCsvFilename(now: Date, scope: string): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return `wellplace-waitlist-${scope}-${day}.csv`;
}

export function waitlistXlsxFilename(now: Date, scope: string): string {
  return waitlistCsvFilename(now, scope).replace(/\.csv$/, ".xlsx");
}
