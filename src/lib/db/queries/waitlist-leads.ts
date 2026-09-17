import { z } from "zod";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Database } from "@/types/database.generated";

export type Salutation = Database["public"]["Enums"]["salutation"];

export interface WaitlistLead {
  id: string;
  salutation: Salutation | null;
  termsAcceptanceVersion: string | null;
  dateOfBirth?: string | null;
  termsAcceptanceText?: string | null;
  marketingGranted?: boolean | null;
  marketingConsentAt?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  ageYears: number | null;
  phoneE164: string;
  phoneCountry: string;
  source: string | null;
  utmCampaign: string | null;
  signupCount: number;
  createdAt: string;
  archivedAt: string | null;
}

export type LeadScope = "active" | "archived" | "all";

export type LeadSort = "latest" | "earliest" | "name" | "signups";

export const LEAD_SORTS: Record<LeadSort, string> = {
  latest: "Newest first",
  earliest: "Oldest first",
  name: "Name A–Z",
  signups: "Most signups",
};

const SORT_COLUMNS: Record<
  LeadSort,
  readonly { column: string; ascending: boolean }[]
> = {
  latest: [{ column: "created_at", ascending: false }],
  earliest: [{ column: "created_at", ascending: true }],
  name: [
    { column: "first_name", ascending: true },
    { column: "last_name", ascending: true },
    { column: "created_at", ascending: false },
  ],
  signups: [
    { column: "signup_count", ascending: false },
    { column: "created_at", ascending: false },
  ],
};

export function isLeadSort(value: unknown): value is LeadSort {
  return typeof value === "string" && value in SORT_COLUMNS;
}

export interface LeadQuery {
  scope: LeadScope;
  from?: string;
  to?: string;
  source?: string;
  campaign?: string;
  marketing?: "granted" | "withdrawn" | "unknown";
  search?: string;
  sort?: LeadSort;
  salutation?: Salutation;
  limit?: number;
  offset?: number;
}

export interface LeadPage {
  rows: WaitlistLead[];
  total: number;
  failed?: boolean;
}

export interface LeadSummary {
  active: number;
  archived: number;
  lastSevenDays: number;
  failed?: boolean;
}

function escapeLike(value: string): string {
  return value.replace(/[%_,()]/g, " ").trim();
}

export async function listWaitlistLeads(
  client: WellPlaceClient,
  { scope, search, sort = "latest", salutation, from, to, source, campaign, marketing, limit = 25, offset = 0 }: LeadQuery,
): Promise<LeadPage> {
  let query = client
    .from("waitlist_leads")
    .select(
      "*",
      { count: "exact" },
    );

  if (scope === "archived") query = query.not("archived_at", "is", null);
  if (scope === "active") query = query.is("archived_at", null);
  if (from) query = query.gte("created_at", `${from}T00:00:00+04:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999999+04:00`);
  if (source) query = query.eq("source", source);
  if (campaign) query = query.eq("utm_campaign", campaign);
  if (marketing === "unknown") query = query.filter("marketing_granted", "is", "null");
  else if (marketing) query = query.filter("marketing_granted", "eq", marketing === "granted");

  if (salutation) query = query.eq("salutation", salutation);

  const term = search ? escapeLike(search) : "";
  const words = term.split(/\s+/).filter(Boolean).slice(0, 5);

  if (words.length) {
    const nameGroup = words
      .map((w) => `or(first_name.ilike.%${w}%,last_name.ilike.%${w}%)`)
      .join(",");

    query = query.or(
      `email.ilike.%${term}%,phone_e164.ilike.%${term}%,and(${nameGroup})`,
    );
  }

  for (const { column, ascending } of SORT_COLUMNS[sort]) {
    query = query.order(column, { ascending });
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("[db] listWaitlistLeads failed:", error.message);
    return { rows: [], total: 0, failed: true };
  }

  if (!z.array(consentSchema).safeParse(data ?? []).success) {
    console.error("[db] waitlist consent projection is unavailable");
    return { rows: [], total: 0, failed: true };
  }
  return {
    total: count ?? 0,
    rows: (data ?? []).map((row) => ({
      ...consentFields(row),
      dateOfBirth: row.date_of_birth,
      referrer: row.referrer,
      utmSource: row.utm_source,
      utmMedium: row.utm_medium,
      utmContent: row.utm_content,
      utmTerm: row.utm_term,
      id: row.id as string,
      salutation: row.salutation,
      termsAcceptanceVersion: row.terms_acceptance_version,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: row.email as string,
      ageYears: row.age_years,
      phoneE164: row.phone_e164 as string,
      phoneCountry: row.phone_country as string,
      source: row.source,
      utmCampaign: row.utm_campaign,
      signupCount: row.signup_count as number,
      createdAt: row.created_at as string,
      archivedAt: row.archived_at,
    })),
  };
}

export async function waitlistSummary(
  client: WellPlaceClient,
): Promise<LeadSummary> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [active, archived, recent] = await Promise.all([
    client.from("waitlist_leads").select("id", { count: "exact", head: true }).is("archived_at", null),
    client.from("waitlist_leads").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
    client.from("waitlist_leads").select("id", { count: "exact", head: true }).is("archived_at", null).gte("created_at", weekAgo),
  ]);

  const failure = active.error ?? archived.error ?? recent.error;
  if (failure) {
    console.error("[db] waitlistSummary failed:", failure.message);
    return { active: 0, archived: 0, lastSevenDays: 0, failed: true };
  }

  return {
    active: active.count ?? 0,
    archived: archived.count ?? 0,
    lastSevenDays: recent.count ?? 0,
  };
}

// [§CMS and waitlist review] Validate the extended view at
// the database boundary. Generated types are refreshed when its migration is applied.
const consentSchema = z.object({
  terms_acceptance_text: z.string().nullable(),
  marketing_granted: z.boolean().nullable(),
  marketing_consent_at: z.string().nullable(),
});
function consentFields(row: unknown) {
  const value = consentSchema.parse(row);
  return { termsAcceptanceText: value.terms_acceptance_text,
    marketingGranted: value.marketing_granted, marketingConsentAt: value.marketing_consent_at };
}

export async function waitlistFilterOptions(client: WellPlaceClient) {
  const sources = new Set<string>();
  const campaigns = new Set<string>();
  const batch = 1000;
  for (let offset = 0; ; offset += batch) {
    const { data, error } = await client.from("waitlist_leads")
      .select("source, utm_campaign").order("id").range(offset, offset + batch - 1);
    if (error) return { sources: [], campaigns: [] };
    for (const row of data ?? []) {
      if (row.source) sources.add(row.source);
      if (row.utm_campaign) campaigns.add(row.utm_campaign);
    }
    if (!data || data.length < batch) break;
  }
  return { sources: [...sources].sort(), campaigns: [...campaigns].sort() };
}
