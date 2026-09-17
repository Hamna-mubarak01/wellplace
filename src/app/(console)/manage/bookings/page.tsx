import type { Metadata } from "next";
import Link from "next/link";
import {
  BanIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  DoorOpenIcon,
  SearchXIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { requireManagement } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { listSuites } from "@/lib/db/queries/board";
import { listManagementBookings } from "@/lib/db/queries/management-bookings";
import { SHOWN_BOOKING_STATUSES } from "@/lib/domain/booking";
import { ConsolePage } from "@/components/console/console-page";
import { FilterBar } from "@/components/console/shared/filter-bar";
import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { EmptyValue } from "@/components/console/shared/empty-value";
import { Button } from "@/components/shared/button";
import { BookingsTable } from "@/components/console/manage/bookings/bookings-table";
import { BookingsExportAction } from "@/components/console/manage/bookings/bookings-export-action";
import { bookingStatusLabel } from "@/components/console/manage/bookings/booking-model";
import {
  BOOKING_PERIODS,
  BOOKINGS_PATH,
  PERIOD_LABEL,
  SOURCE_FILTERS,
  SOURCE_FILTER_LABEL,
  STATUS_GROUP_LABEL,
  SUMMARY_KEYS,
  bookingsHref,
  exportHref,
  filtersHref,
  isFiltered,
  listRequest,
  matchesFilters,
  monthBounds,
  parseBookingsQuery,
  sortDirection,
  summaryFilters,
  summaryRequest,
  type BookingsSearchParams,
  type SummaryKey,
} from "@/app/(console)/manage/bookings/bookings-view";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

function countValue(total: number | null) {
  return total === null ? <EmptyValue label="Could not be counted" /> : total.toLocaleString("en-AE");
}

export default async function ManageBookingsPage({
  searchParams,
}: {
  searchParams: Promise<BookingsSearchParams>;
}) {
  await requireManagement();
  const params = await searchParams;
  const supabase = await createClient();
  const now = new Date();

  const suites = await listSuites(supabase, { includeRetired: true });
  const suiteRows = suites.ok ? suites.suites : [];
  const suiteIds = suiteRows.map((suite) => suite.id);
  const query = parseBookingsQuery(params, suiteIds);
  const filters = summaryFilters(now);

  const [listing, ...summaries] = await Promise.all([
    listManagementBookings(supabase, listRequest(query, now)),
    ...SUMMARY_KEYS.map((key) => listManagementBookings(supabase, summaryRequest(filters[key], suiteIds, now))),
  ]);

  const counts = Object.fromEntries(
    SUMMARY_KEYS.map((key, index) => {
      const summary = summaries[index];
      return [key, summary.ok ? summary.total : null];
    }),
  ) as Record<SummaryKey, number | null>;

  const filtered = isFiltered(query);
  const month = monthBounds(now);
  const attention = counts.attention ?? 0;

  return (
    <ConsolePage
      title="Bookings"
      actions={<BookingsExportAction href={exportHref(params)} filtered={filtered} />}
    >
      <StatGrid columns={5} label="Bookings summary">
        <StatCard
          label="Today"
          value={countValue(counts.today)}
          sub="Confirmed, in the suite or completed"
          Icon={CalendarCheckIcon}
          href={filtersHref(filters.today)}
          selected={matchesFilters(query, filters.today, suiteIds)}
        />
        <StatCard
          label="Upcoming"
          value={countValue(counts.upcoming)}
          sub="Confirmed visits still to come"
          Icon={CalendarClockIcon}
          href={filtersHref(filters.upcoming)}
          selected={matchesFilters(query, filters.upcoming, suiteIds)}
        />
        <StatCard
          label="In the suite now"
          value={countValue(counts.inSuite)}
          sub="Checked in"
          tone="success"
          Icon={DoorOpenIcon}
          href={filtersHref(filters.inSuite)}
          selected={matchesFilters(query, filters.inSuite, suiteIds)}
        />
        <StatCard
          label="Needs attention"
          value={countValue(counts.attention)}
          sub="Awaiting payment, failed payment or awaiting recovery"
          tone={attention > 0 ? "warning" : "neutral"}
          Icon={TriangleAlertIcon}
          href={filtersHref(filters.attention)}
          selected={matchesFilters(query, filters.attention, suiteIds)}
        />
        <StatCard
          label="Cancelled this month"
          value={countValue(counts.cancelled)}
          sub={`Visits in ${month.label}`}
          Icon={BanIcon}
          href={filtersHref(filters.cancelled)}
          selected={matchesFilters(query, filters.cancelled, suiteIds)}
        />
      </StatGrid>

      <FilterBar
        label="Filter bookings"
        search={{
          label: "Search bookings",
          placeholder: "Reference, name, email or mobile",
          value: query.search,
        }}
        selects={[
          {
            param: "status",
            label: "Status",
            allLabel: "All statuses",
            value: query.status,
            options: [
              { value: "attention", label: STATUS_GROUP_LABEL.attention },
              { value: "visits", label: STATUS_GROUP_LABEL.visits },
              ...SHOWN_BOOKING_STATUSES.map((status) => ({ value: status, label: bookingStatusLabel(status) })),
            ],
          },
          {
            param: "suite",
            label: "Suite",
            allLabel: "All suites",
            value: query.suiteId,
            options: suiteRows.map((suite) => ({ value: suite.id, label: `Suite ${suite.suiteNumber}` })),
          },
          {
            param: "source",
            label: "Booked via",
            allLabel: "Website and reception",
            value: query.source,
            options: SOURCE_FILTERS.map((source) => ({ value: source, label: SOURCE_FILTER_LABEL[source] })),
          },
        ]}
        dateRange={{ label: "Date range", from: query.from, to: query.to, clears: ["period"] }}
        period={{
          label: "Period",
          value: query.period,
          defaultValue: "all",
          clears: ["from", "to"],
          options: BOOKING_PERIODS.map((period) => ({ value: period, label: PERIOD_LABEL[period] })),
        }}
        resultsLabel={
          listing.ok
            ? `${listing.total.toLocaleString("en-AE")} ${listing.total === 1 ? "booking" : "bookings"}`
            : undefined
        }
      />

      <BookingsTable
        rows={listing.ok ? listing.rows : []}
        error={listing.ok ? null : { title: "Bookings could not be loaded", message: listing.message }}
        sort={{
          key: query.sort,
          direction: sortDirection(query),
          hrefFor: (key, direction) => bookingsHref(params, { sort: key, dir: direction }),
        }}
        pagination={{
          page: listing.ok ? listing.page : 1,
          pageSize: listing.ok ? listing.pageSize : 1,
          total: listing.ok ? listing.total : 0,
          hrefFor: (target) => bookingsHref(params, { page: target > 1 ? String(target) : null }),
          noun: { one: "booking", other: "bookings" },
        }}
        empty={
          filtered
            ? {
                title: "No bookings match these filters",
                description: "Clear a filter, or search by another reference, name, email or mobile.",
                Icon: SearchXIcon,
                action: (
                  <Button asChild variant="outline">
                    <Link href={BOOKINGS_PATH}>Clear filters</Link>
                  </Button>
                ),
              }
            : {
                title: "No bookings yet",
                description: "Bookings made online, at the front desk or by phone appear here.",
                Icon: CalendarCheckIcon,
              }
        }
      />
    </ConsolePage>
  );
}
