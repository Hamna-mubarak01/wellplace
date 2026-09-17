import { z } from "zod";
import { SearchXIcon, TriangleAlertIcon } from "lucide-react";

import { requireSetting } from "@/lib/config";
import { SUITE_DRAWER_BOOKINGS_LIMIT } from "@/lib/config/suite-management";
import { createClient } from "@/lib/db/server";
import { listManagementCatalogue } from "@/lib/db/queries/catalogue";
import {
  listSuiteBookedDates,
  listSuiteBookings,
  type ManagementBookingRow,
} from "@/lib/db/queries/management-bookings";
import type { Paged } from "@/lib/db/queries/paging";
import { listPriceTiers } from "@/lib/db/queries/pricing";
import { readSettingsSnapshot } from "@/lib/db/queries/settings";
import { findManagedSuite } from "@/lib/db/queries/suite-inventory";
import { dailyFirstHourRates } from "@/lib/domain/pricing";
import { isoDatesInMonth, todayInDubai } from "@/lib/domain/time";
import { SuiteActions } from "@/components/console/manage/suites/suite-actions";
import { SuiteBookings, type SuiteBookingsResult } from "@/components/console/manage/suites/suite-bookings";
import { SuiteDrawerHeader } from "@/components/console/manage/suites/suite-drawer-header";
import { SuiteDrawerMessage } from "@/components/console/manage/suites/suite-drawer-message";
import { SuiteDrawerTabs } from "@/components/console/manage/suites/suite-drawer-tabs";
import { SuiteOverview } from "@/components/console/manage/suites/suite-overview";
import { SuitePricing } from "@/components/console/manage/suites/suite-pricing";
import { bookingsHref } from "@/app/(console)/manage/bookings/bookings-view";
import {
  SUITE_BOOKING_STATUSES,
  monthLabel,
  monthParts,
  shiftMonth,
  splitSuiteBookings,
  tabParam,
  type SuiteDrawerQuery,
  type SuiteTab,
} from "@/app/(console)/manage/suites/suite-detail-view";
import {
  BOOKED_MONTH_PARAM,
  RATES_MONTH_PARAM,
  SUITE_TAB_PARAM,
  liveState,
  staffState,
  suiteName,
  suitesHref,
  type SuitesSearchParams,
} from "@/app/(console)/manage/suites/suites-view";

const PRICING_PATH = "/manage/pricing";
const PRICING_SETTINGS = ["pricing.rounding_fils"] as const;

export interface SuiteDrawerContentProps {
  suiteId: string;
  query: SuiteDrawerQuery;
  params: SuitesSearchParams;
}

function bookingsResult(
  upcoming: Paged<ManagementBookingRow>,
  earlier: Paged<ManagementBookingRow>,
): SuiteBookingsResult {
  if (!upcoming.ok) return { ok: false, message: upcoming.message };
  if (!earlier.ok) return { ok: false, message: earlier.message };
  return { ok: true, ...splitSuiteBookings(upcoming.rows, earlier.rows, SUITE_DRAWER_BOOKINGS_LIMIT) };
}

function SuiteNotFound() {
  return (
    <SuiteDrawerMessage
      Icon={SearchXIcon}
      title="Suite not found"
      description="It may have been deleted. Close this panel and choose another suite from the list."
    />
  );
}

export async function SuiteDrawerContent({ suiteId, query, params }: SuiteDrawerContentProps) {
  if (!z.uuid().safeParse(suiteId).success) return <SuiteNotFound />;

  const client = await createClient();
  const now = new Date();
  const nowInstant = now.toISOString();
  const today = todayInDubai(now);
  const rateMonth = monthParts(query.rateMonth);

  const [lookup, upcoming, earlier, booked, tiers, settings, catalogue] = await Promise.all([
    findManagedSuite(client, suiteId),
    listSuiteBookings(client, suiteId, {
      page: 1,
      pageSize: SUITE_DRAWER_BOOKINGS_LIMIT,
      statuses: SUITE_BOOKING_STATUSES,
      from: nowInstant,
      oldestFirst: true,
    }),
    listSuiteBookings(client, suiteId, {
      page: 1,
      pageSize: SUITE_DRAWER_BOOKINGS_LIMIT,
      statuses: SUITE_BOOKING_STATUSES,
      to: nowInstant,
      oldestFirst: false,
    }),
    listSuiteBookedDates(client, suiteId, query.bookedMonth),
    listPriceTiers(client),
    readSettingsSnapshot(client, PRICING_SETTINGS),
    listManagementCatalogue(client),
  ]);

  if (lookup.outcome === "not_found") return <SuiteNotFound />;
  if (lookup.outcome === "failed") {
    return (
      <SuiteDrawerMessage
        Icon={TriangleAlertIcon}
        tone="danger"
        title="This suite could not be loaded"
        description={`${lookup.message} Its setup and bookings have not changed. Close this panel and open the suite again.`}
      />
    );
  }

  if (!tiers.ok) console.error("[manage/suites] price rules unavailable:", tiers.message);
  if (!settings.ok) console.error("[manage/suites] pricing settings unavailable:", settings.message);

  const suite = lookup.suite;
  const live = liveState(suite);
  const rates =
    tiers.ok && settings.ok
      ? dailyFirstHourRates(
          tiers.tiers,
          "adult",
          isoDatesInMonth(rateMonth.year, rateMonth.month),
          requireSetting(settings.snapshot, "pricing.rounding_fils"),
        )
      : null;

  const monthLink = (param: string, tab: SuiteTab, month: string) => ({
    href: suitesHref(params, { [param]: month, [SUITE_TAB_PARAM]: tabParam(tab) }),
    label: monthLabel(month),
  });

  return (
    <>
      <SuiteDrawerHeader
        suiteNumber={suite.suiteNumber}
        name={suiteName(suite)}
        status={live}
        actions={<SuiteActions suite={suite} live={live} />}
      />
      <SuiteDrawerTabs
        panels={{
          overview: (
            <SuiteOverview
              suite={suite}
              live={live}
              staffStatus={staffState(suite)}
              now={now}
              today={today}
              bookedMonth={query.bookedMonth}
              bookedMonthLabel={monthLabel(query.bookedMonth)}
              booked={booked}
              previousMonth={monthLink(BOOKED_MONTH_PARAM, "overview", shiftMonth(query.bookedMonth, -1))}
              nextMonth={monthLink(BOOKED_MONTH_PARAM, "overview", shiftMonth(query.bookedMonth, 1))}
            />
          ),
          bookings: (
            <SuiteBookings
              result={bookingsResult(upcoming, earlier)}
              now={now}
              viewAllHref={bookingsHref({}, { suite: suite.id })}
            />
          ),
          pricing: (
            <SuitePricing
              today={today}
              rateMonth={query.rateMonth}
              rateMonthLabel={monthLabel(query.rateMonth)}
              rates={rates}
              previousMonth={monthLink(RATES_MONTH_PARAM, "pricing", shiftMonth(query.rateMonth, -1))}
              nextMonth={monthLink(RATES_MONTH_PARAM, "pricing", shiftMonth(query.rateMonth, 1))}
              addons={catalogue.ok ? { ok: true, addons: catalogue.addons } : { ok: false, message: catalogue.message }}
              pricingHref={PRICING_PATH}
            />
          ),
        }}
      />
    </>
  );
}
