import { parseWaitlistFilters } from "@/lib/config/waitlist-filters";
import type { Metadata } from "next";
import { UserPlusIcon, UsersRoundIcon } from "lucide-react";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import { requireManagement } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  LEAD_SORTS,
  isLeadSort,
  listWaitlistLeads,
  waitlistSummary,
  waitlistFilterOptions,
  type LeadSort,
  type WaitlistLead,
} from "@/lib/db/queries/waitlist-leads";
import { AddLeadDialog } from "@/components/console/add-lead-dialog";
import { LeadsExportButton } from "@/components/console/leads-export-button";
import { LeadsTable } from "@/components/console/leads-table";
import { SALUTATION_OPTIONS, parseSalutationFilter } from "@/components/console/leads-filters";
import { ConsolePage } from "@/components/console/console-page";
import { FilterBar } from "@/components/console/shared/filter-bar";
import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { EmptyValue } from "@/components/console/shared/empty-value";
import { ConsoleReadError } from "@/components/shared/console-read-error";

export const metadata: Metadata = {
  title: "Waitlist",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = CONSOLE_LIST.pageSize;

const DEFAULT_SORT: LeadSort = "latest";

const SORT_OPTIONS = (Object.keys(LEAD_SORTS) as LeadSort[]).map((value) => ({
  value,
  label: LEAD_SORTS[value],
}));

const EVERYONE = SALUTATION_OPTIONS.find((option) => option.value === "any")?.label ?? "Everyone";

const SALUTATION_FILTERS = SALUTATION_OPTIONS.filter((option) => option.value !== "any");

function people(count: number): string {
  return `${count.toLocaleString("en-AE")} ${count === 1 ? "person" : "people"}`;
}

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{
    [key: string]: string | undefined;
    q?: string;
    page?: string;
    salutation?: string;
    sort?: string;
  }>;
}) {
  const session = await requireManagement();
  const rawParams = await searchParams;
  const filters = parseWaitlistFilters({ get: (key) => rawParams[key] ?? null });
  const {
    q,
    page: rawPage,
    salutation: rawSalutation,
    sort: rawSort,
  } = rawParams;

  const page = Math.max(1, Number(rawPage) || 1);
  const search = q?.trim() ?? "";
  const salutation = parseSalutationFilter(rawSalutation);
  const sort: LeadSort = isLeadSort(rawSort) ? rawSort : DEFAULT_SORT;

  const supabase = await createClient();
  const [summary, fetched, options] = await Promise.all([
    waitlistSummary(supabase),
    listWaitlistLeads(supabase, {
      ...filters,
      search,
      sort,
      salutation: salutation === "any" ? undefined : salutation,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    waitlistFilterOptions(supabase),
  ]);

  const rows: WaitlistLead[] = fetched.rows;
  const total = fetched.total;

  const filtered = search.length > 0 || salutation !== "any" || Object.entries(filters).some(([key, value]) => key === "scope" ? value !== "all" : Boolean(value));

  const canManage = session.role === "management";

  return (
    <ConsolePage
      title="Waitlist"
      actions={
        canManage ? (
          <>
            <LeadsExportButton total={total} />
            <AddLeadDialog minAge={requireSetting(EMPTY_SNAPSHOT, "booking.booker_min_age")} />
          </>
        ) : undefined
      }
    >
      <StatGrid columns={2} label="Waitlist totals">
        <StatCard label="On the list" value={summary.failed ? <EmptyValue /> : summary.active} Icon={UsersRoundIcon} />
        <StatCard
          label="Joined recently"
          value={summary.failed ? <EmptyValue /> : summary.lastSevenDays}
          sub="Last seven days"
          tone={!summary.failed && summary.lastSevenDays > 0 ? "success" : "neutral"}
          Icon={UserPlusIcon}
        />
      </StatGrid>

      <FilterBar
        label="Filter the waitlist"
        search={{
          label: "Search the waitlist",
          placeholder: "Name, email or number",
          value: search,
        }}
        dateRange={{ label: "Signup period", from: filters.from ?? null, to: filters.to ?? null }}
        selects={[
          { param: "scope", label: "Status", allLabel: "All entries", value: filters.scope === "all" ? null : filters.scope,
            options: [{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }] },
          { param: "marketing", label: "Marketing", allLabel: "All marketing statuses", value: filters.marketing ?? null,
            options: [{ value: "granted", label: "Subscribed" }, { value: "withdrawn", label: "Withdrawn" }, { value: "unknown", label: "Not recorded" }] },
          { param: "source", label: "Source", allLabel: "All sources", value: filters.source ?? null,
            options: options.sources.map((value) => ({ value, label: value })) },
          { param: "campaign", label: "Campaign", allLabel: "All campaigns", value: filters.campaign ?? null,
            options: options.campaigns.map((value) => ({ value, label: value })) },
          {
            param: "salutation",
            label: "Salutation",
            allLabel: EVERYONE,
            value: salutation === "any" ? null : salutation,
            options: SALUTATION_FILTERS,
          },
        ]}
        period={{
          param: "sort",
          label: "Sort",
          value: sort,
          defaultValue: DEFAULT_SORT,
          options: SORT_OPTIONS,
        }}
        resultsLabel={people(total)}
      />

      {fetched.failed ? (
        <ConsoleReadError
          title="The waitlist could not be loaded"
          message="The waitlist could not be loaded. Refresh the page to try again."
          remedy="Refresh the page to try again."
        />
      ) : (
        <LeadsTable
          rows={rows}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          canManage={canManage}
          filtered={filtered}
        />
      )}
    </ConsolePage>
  );
}
