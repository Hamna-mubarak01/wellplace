import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArchiveIcon,
  CircleCheckIcon,
  DoorOpenIcon,
  SearchXIcon,
  ShieldAlertIcon,
  UsersRoundIcon,
} from "lucide-react";

import { requireManagement } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { listSuiteInventory } from "@/lib/db/queries/suite-inventory";
import { todayInDubai } from "@/lib/domain/time";
import { ConsolePage } from "@/components/console/console-page";
import { ConsoleEmpty } from "@/components/console/console-surface";
import { FilterBar } from "@/components/console/shared/filter-bar";
import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { AddSuiteButton } from "@/components/console/manage/suites/add-suite-button";
import { SuiteCard } from "@/components/console/manage/suites/suite-card";
import { SuiteDrawer } from "@/components/console/manage/suites/suite-drawer";
import { SuiteDrawerSkeleton } from "@/components/console/manage/suites/suite-drawer-skeleton";
import { ReceptionAutoRefresh } from "@/components/console/reception/auto-refresh";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { Button } from "@/components/shared/button";
import { SuiteDrawerContent } from "@/app/(console)/manage/suites/suite-drawer-content";
import { parseSuiteDrawerQuery } from "@/app/(console)/manage/suites/suite-detail-view";
import {
  RETIRED_VIEWS,
  RETIRED_VIEW_LABEL,
  SUITES_PATH,
  SUITE_GROUPS,
  SUITE_GROUP_LABEL,
  filterSuites,
  isFiltered,
  listParams,
  nextSuiteNumber,
  parseSuitesQuery,
  suitesHref,
  summariseSuites,
  type SuitesSearchParams,
} from "@/app/(console)/manage/suites/suites-view";

export const metadata: Metadata = { title: "Suites", robots: { index: false, follow: false } };

export default async function ManageSuitesPage({
  searchParams,
}: {
  searchParams: Promise<SuitesSearchParams>;
}) {
  await requireManagement();
  const params = await searchParams;
  const now = new Date();
  const filters = listParams(params);
  const query = parseSuitesQuery(filters);
  const drawer = parseSuiteDrawerQuery(params, todayInDubai(now));
  const panel =
    drawer.suiteId === null ? null : (
      <Suspense key={drawer.suiteId} fallback={<SuiteDrawerSkeleton />}>
        <SuiteDrawerContent suiteId={drawer.suiteId} query={drawer} params={params} />
      </Suspense>
    );
  const listing = await listSuiteInventory(await createClient());

  if (!listing.ok) {
    return (
      <SuiteDrawer suiteId={drawer.suiteId} panel={panel}>
        <ConsolePage title="Suites">
          <ConsoleReadError
            title="The suites could not be loaded"
            message={listing.message}
            meaning="Suite setup and availability have not changed."
            remedy="Reload the page to try again."
          />
        </ConsolePage>
      </SuiteDrawer>
    );
  }

  const suites = listing.suites;
  const summary = summariseSuites(suites);
  const visible = filterSuites(suites, query);
  const filtered = isFiltered(query);
  const suggestedNumber = nextSuiteNumber(suites);

  return (
    <SuiteDrawer suiteId={drawer.suiteId} panel={panel}>
      <ConsolePage title="Suites" actions={<AddSuiteButton suggestedNumber={suggestedNumber} />}>
        <ReceptionAutoRefresh />

        <StatGrid columns={summary.retired > 0 ? 5 : 4} label="Suite summary">
          <StatCard
            label="Active suites"
            value={summary.active}
            sub="In service"
            Icon={DoorOpenIcon}
            href={suitesHref(filters, { status: null, retired: null })}
          />
          <StatCard
            label="Available now"
            value={summary.available}
            sub="Free to book right now"
            tone="success"
            Icon={CircleCheckIcon}
            href={suitesHref(filters, { status: "available", retired: null })}
            selected={query.group === "available"}
          />
          <StatCard
            label="In use now"
            value={summary.inUse}
            sub="Held, booked, checked in or cleaning"
            tone="info"
            Icon={UsersRoundIcon}
            href={suitesHref(filters, { status: "in_use", retired: null })}
            selected={query.group === "in_use"}
          />
          <StatCard
            label="Held by staff"
            value={summary.held}
            sub="Not ready, blocked, maintenance or out of service"
            tone="warning"
            Icon={ShieldAlertIcon}
            href={suitesHref(filters, { status: "held", retired: null })}
            selected={query.group === "held"}
          />
          {summary.retired > 0 && (
            <StatCard
              label="Retired"
              value={summary.retired}
              sub="No longer taking bookings"
              Icon={ArchiveIcon}
              href={suitesHref(filters, { retired: "only", status: null })}
              selected={query.retired === "only"}
            />
          )}
        </StatGrid>

        <FilterBar
          label="Filter suites"
          search={{
            label: "Search suites",
            placeholder: "Suite number or name",
            value: query.search,
          }}
          selects={[
            {
              param: "status",
              label: "Status",
              allLabel: "All statuses",
              value: query.group,
              options: SUITE_GROUPS.map((group) => ({ value: group, label: SUITE_GROUP_LABEL[group] })),
            },
          ]}
          period={
            summary.retired > 0 || query.retired !== "hide"
              ? {
                  param: "retired",
                  label: "Retired suites",
                  value: query.retired,
                  defaultValue: "hide",
                  options: RETIRED_VIEWS.map((view) => ({ value: view, label: RETIRED_VIEW_LABEL[view] })),
                }
              : undefined
          }
          resultsLabel={`${visible.length.toLocaleString("en-AE")} of ${suites.length.toLocaleString("en-AE")} suites shown`}
        />

        {visible.length === 0 ? (
          suites.length === 0 ? (
            <ConsoleEmpty
              Icon={DoorOpenIcon}
              title="No suites yet"
              description="Add your first suite to start taking bookings."
              action={<AddSuiteButton suggestedNumber={suggestedNumber} />}
            />
          ) : filtered ? (
            <ConsoleEmpty
              Icon={SearchXIcon}
              title="No suites match these filters"
              description="Clear a filter, or search by another number or name."
              action={
                <Button asChild variant="outline">
                  <Link href={SUITES_PATH}>Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <ConsoleEmpty
              Icon={ArchiveIcon}
              title="Every suite is retired"
              description="Return a suite to service, or add a new one, to take bookings again."
              action={
                <Button asChild variant="outline">
                  <Link href={suitesHref(filters, { retired: "only" })}>Show retired suites</Link>
                </Button>
              }
            />
          )
        ) : (
          <div className="@container min-w-0">
            <ul
              aria-label="Suites"
              className="grid auto-rows-fr grid-cols-1 gap-4 @md:grid-cols-2 @2xl:grid-cols-3 @5xl:grid-cols-4"
            >
              {visible.map((suite) => (
                <SuiteCard key={suite.id} suite={suite} now={now} />
              ))}
            </ul>
          </div>
        )}
      </ConsolePage>
    </SuiteDrawer>
  );
}
