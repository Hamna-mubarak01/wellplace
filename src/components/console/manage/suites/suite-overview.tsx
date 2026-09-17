import { DetailField } from "@/components/console/shared/detail-field";
import { DetailFieldGrid } from "@/components/console/shared/detail-field-grid";
import { BookedDatesCalendar } from "@/components/console/manage/suites/booked-dates-calendar";
import { MonthNav, type MonthLink } from "@/components/console/manage/suites/month-nav";
import { SuiteDrawerSection } from "@/components/console/manage/suites/suite-drawer-section";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { Separator } from "@/components/ui/separator";
import type { SuiteBookedDates } from "@/lib/db/queries/management-bookings";
import type { ManagedSuite } from "@/lib/db/queries/suite-inventory";
import { formatDubaiDateTime } from "@/lib/domain/time";
import { formatDubaiMoment, LIVE_STATE_LABEL, type LiveState } from "@/app/(console)/manage/suites/suites-view";

export interface SuiteOverviewProps {
  staffStatus: LiveState;
  suite: ManagedSuite;
  live: LiveState;
  now: Date;
  today: string;
  bookedMonth: string;
  bookedMonthLabel: string;
  booked: SuiteBookedDates;
  previousMonth: MonthLink;
  nextMonth: MonthLink;
}

export function SuiteOverview({
  suite,
  live,
  staffStatus,
  now,
  today,
  bookedMonth,
  bookedMonthLabel,
  booked,
  previousMonth,
  nextMonth,
}: SuiteOverviewProps) {
  const retired = live === "retired";

  return (
    <>
      <SuiteDrawerSection id="suite-drawer-details" title="Details">
        <DetailFieldGrid columns={2}>
          <DetailField label="Suite number" value={suite.suiteNumber} data />
          <DetailField label="Name" value={suite.displayName?.trim()} emptyLabel="Not named" />
          <DetailField label="Booking priority" value={suite.priority} data />
          <DetailField label="Staff status" value={LIVE_STATE_LABEL[staffStatus]} />
          <DetailField
            label="Next booking"
            value={suite.nextBookingAt ? formatDubaiMoment(suite.nextBookingAt, now) : null}
            emptyLabel="No booking scheduled"
            data
            span="full"
          />
          {retired && (
            <>
              <DetailField
                label="Retired on"
                value={suite.retiredAt ? formatDubaiDateTime(suite.retiredAt) : null}
                emptyLabel="Not recorded"
              />
              <DetailField label="Retired by" value={suite.retiredByName} emptyLabel="Not recorded" />
              <DetailField
                label="Why it was retired"
                value={suite.retirementReason && <span className="whitespace-pre-wrap">{suite.retirementReason}</span>}
                emptyLabel="Not recorded"
                span="full"
              />
            </>
          )}
          <DetailField
            label="Internal note"
            value={suite.internalNote && <span className="whitespace-pre-wrap">{suite.internalNote}</span>}
            emptyLabel="No note"
            span="full"
          />
        </DetailFieldGrid>
      </SuiteDrawerSection>

      <Separator className="bg-border" />

      <SuiteDrawerSection
        id="suite-drawer-booked-dates"
        title="Booked dates"
        control={<MonthNav label={bookedMonthLabel} previous={previousMonth} next={nextMonth} />}
      >
        {booked.ok ? (
          <BookedDatesCalendar month={bookedMonth} today={today} dates={booked.dates} />
        ) : (
          <ConsoleReadError
            title="Booked dates could not be loaded"
            message={booked.message}
            remedy="Close the suite and open it again."
          />
        )}
      </SuiteDrawerSection>
    </>
  );
}
