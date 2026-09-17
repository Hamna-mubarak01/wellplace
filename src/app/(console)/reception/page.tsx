import { Suspense } from "react";
import { DeskUpdates } from "@/components/console/reception/desk-updates";
import type { Metadata } from "next";
import Link from "next/link";
import { listOpenAlerts, listTasks, listShiftNotes, listCleaningTasks } from "@/lib/db/queries/operations";
import { listArrivals } from "@/lib/db/queries/bookings";
import { AlertList } from "@/components/console/reception/alert-list";
import { FrontDeskPreview } from "@/components/console/reception/front-desk-preview";
import { ShiftNoteList } from "@/components/console/reception/shift-note-list";
import { CleaningBoard } from "@/components/console/reception/cleaning-board";
import { listStaff } from "@/lib/db/queries/staff";
import { TaskList } from "@/components/console/reception/task-list";
import { NextArrivalCard } from "@/components/console/reception/next-arrival-card";
import { TimelineZoomProvider } from "@/components/console/reception/timeline-zoom";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { Button } from "@/components/shared/button";
import { FrontDeskSearch } from "@/components/console/reception/front-desk-search";
import { ListChecksIcon, SparklesIcon } from "lucide-react";

import { requireReception } from "@/lib/auth/session";
import { requireSetting } from "@/lib/config";
import { createBooking } from "@/app/(console)/reception/actions";
import { createClient } from "@/lib/db/server";
import { loadSettingsSnapshot } from "@/lib/db/queries/settings";
import { listAddonCatalogue } from "@/lib/db/queries/pricing";
import { describeImage } from "@/lib/config/cms/image-alt";
import {
  businessDayWindow,
  dayWindow,
  getBoard,
  operatingDayInDubai,
  getPeriodBoard,
  monthSelection,
  weekRange,
} from "@/lib/services/board-service";
import { isScheduleDate } from "@/lib/console/schedule-range";
import { toCalendarDate, todayInDubai } from "@/lib/domain/time";
import { CalendarOffIcon, TriangleAlertIcon } from "lucide-react";

import { DeskWorkspace } from "@/components/console/reception/desk-workspace";
import { ConsoleNotice, ConsoleSection } from "@/components/console/console-surface";
import { BoardLegend } from "@/components/console/reception/board-legend";
import { ScheduleToolbar } from "@/components/console/reception/schedule-toolbar";
import { resolveBoardView, type BoardView } from "@/components/console/reception/board-view-config";
import { WeekSuiteSchedule } from "@/components/console/reception/week-suite-schedule";
import { PeriodGrid } from "@/components/console/reception/period-grid";
import { SuiteTimeline } from "@/components/console/reception/suite-timeline";
import { WalkInLauncher } from "@/components/console/reception/walk-in-launcher";

export const metadata: Metadata = {
  title: "Front desk",
  robots: { index: false, follow: false },
};

const STEP: Readonly<Record<BoardView, number>> = {
  day: 1,
  week: 7,
  month: 28,
  timeline: 1,
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export default async function FrontDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; preview?: string; to?: string }>;
}) {
  const session = await requireReception();
  const { view: rawView, date: rawDate, preview, to: rawTo } = await searchParams;
  if (process.env.NODE_ENV === "development" && preview === "1") {
    return <FrontDeskPreview date={isScheduleDate(rawDate) ? rawDate : todayInDubai()} userId={session.userId} view={resolveBoardView(rawView)} endDate={rawTo} />;
  }

  const supabase = await createClient();
  const snapshotPromise = loadSettingsSnapshot(supabase);
  const addonPromise = listAddonCatalogue(supabase);
  const alertsPromise = listOpenAlerts(supabase);
  const tasksPromise = listTasks(supabase, { assignedTo: session.userId });
  const notesPromise = listShiftNotes(supabase, { pendingOnly: true });
  const staffPromise = listStaff(supabase);
  const snapshot = await snapshotPromise;
  const today = operatingDayInDubai(snapshot);
  const date = isScheduleDate(rawDate) ? rawDate : today;
  const cleaningWindow = businessDayWindow(snapshot, date);
  const cleaningPromise = listCleaningTasks(supabase, { from: cleaningWindow.start, to: cleaningWindow.end });
  const configuredView = requireSetting(snapshot, "reception.board_default_view");
  const view = resolveBoardView(rawView, resolveBoardView(configuredView));
  const isToday = date === today;

  const isPeriod = view === "week" || view === "month";
  const month = monthSelection(date, rawTo);
  const range = view === "week" ? weekRange(date) : view === "month" ? month.calendar : null;

  const day = isPeriod ? null : dayWindow(snapshot, toCalendarDate(date));

  const todayWindow = dayWindow(snapshot, toCalendarDate(today));
  const updatesPromise = Promise.all([
    alertsPromise,
    tasksPromise,
    todayWindow.window === null ? Promise.resolve({ ok: true as const, arrivals: [] }) : listArrivals(supabase, { from: todayWindow.window.start, to: todayWindow.window.end }),
    notesPromise,
    cleaningPromise,
    staffPromise,
  ]);
  const [boardResult, period] = await Promise.all([
    isPeriod ? Promise.resolve(null) : getBoard(supabase, businessDayWindow(snapshot, date)),
    range === null ? Promise.resolve(null) : getPeriodBoard(supabase, snapshot, range),
  ]);
  const board = boardResult ? { ...boardResult, openingWindow: day?.window } : null;

  return (
    <div className="reception-front mx-auto flex w-full min-w-0 flex-col gap-3 p-3 sm:p-4 lg:px-6">
      <h1 className="sr-only">Front desk</h1>
      <DeskWorkspace
        toolbar={<FrontDeskSearch />}
        actions={<Suspense fallback={<Button disabled>Loading new booking…</Button>}>
          <FrontDeskBooking addonPromise={addonPromise} snapshot={snapshot} date={date} today={today} />
        </Suspense>}
        updates={<Suspense fallback={<Button variant="outline" size="sm" disabled>Loading updates…</Button>}>
          <FrontDeskUpdates data={updatesPromise} snapshot={snapshot} date={date} today={today} userId={session.userId} />
        </Suspense>}
      >
        <TimelineZoomProvider initialZoom={view === "timeline" ? "wide" : "fit"} durationsHours={requireSetting(snapshot, "booking.durations_hours")} openingMinutes={day?.window ? (Date.parse(day.window.end) - Date.parse(day.window.start)) / 60_000 : null}>
        <div className="flex min-w-0 flex-col gap-3 rounded-(--radius-card) border border-border bg-surface-raised p-3">
          <ScheduleToolbar view={view} date={date} today={today} step={view === "month" ? month.selected?.days.length ?? STEP[view] : STEP[view]} endDate={view === "month" ? month.selected?.to : undefined} />
      {day?.status === "hours_unconfigured" && (
        <ConsoleNotice Icon={TriangleAlertIcon}>
          Opening hours have not been set yet. Showing the full day.
        </ConsoleNotice>
      )}

      {day?.status === "closed" && (
        <ConsoleNotice tone="neutral" Icon={CalendarOffIcon}>
          WellPlace is closed on this day.
        </ConsoleNotice>
      )}

      {board !== null && (
        <div className="flex flex-col gap-3">
          <SuiteTimeline
            board={board}
            intervalMinutes={requireSetting(
              snapshot,
              "booking.start_interval_minutes",
            )}
            zoom={view === "timeline" ? "wide" : "fit"}
            showNow={isToday}
            scrollToNow={isToday}
          />
          <BoardLegend />
        </div>
      )}

      {period !== null && range !== null && (
        <div className="flex flex-col gap-3">
          {view !== "month" ? <WeekSuiteSchedule suites={period.suites} today={today} days={range.days.map((date) => ({ date, entries: period.byDay.get(date) ?? [] }))} /> : <PeriodGrid
            columns={7}
            weekdayLabels={WEEKDAYS}
            suiteCount={period.suites.length}
            suites={period.suites}
            days={range.days.map((isoDate) => ({
              isoDate,
              label: isoDate.slice(8),
              inPeriod: month.selected ? isoDate >= month.selected.from && isoDate <= month.selected.to : isoDate.slice(0, 7) === date.slice(0, 7),
              disabled: month.selected !== null && (isoDate < month.selected.from || isoDate > month.selected.to),
              isToday: isoDate === today,
              entries: period.byDay.get(isoDate) ?? [],
            }))}
          />}
          <BoardLegend />
        </div>
      )}
        </div>
        </TimelineZoomProvider>
      </DeskWorkspace>
    </div>
  );
}

async function FrontDeskBooking({ addonPromise, snapshot, date, today }: {
  addonPromise: ReturnType<typeof listAddonCatalogue>;
  snapshot: Awaited<ReturnType<typeof loadSettingsSnapshot>>;
  date: string;
  today: string;
}) {
  const addonListing = await addonPromise;
  if (!addonListing.ok) {
    return <div className="flex max-w-sm flex-col gap-2">
      <Button disabled>New booking unavailable</Button>
      <p role="status" className="text-micro text-text-secondary">{addonListing.message} The schedule is still available. Updates retry automatically.</p>
    </div>;
  }
  return <WalkInLauncher
    key={`booking-${date}`}
    earliestDate={today}
    rules={{
      guestsMin: requireSetting(snapshot, "booking.guests_min"),
      guestsMax: requireSetting(snapshot, "booking.guests_max"),
      childMinAge: requireSetting(snapshot, "booking.child_min_age"),
      childMaxAge: requireSetting(snapshot, "booking.child_max_age"),
      bookerMinAge: requireSetting(snapshot, "booking.booker_min_age"),
    }}
    offerLabel={requireSetting(snapshot, "pricing.offer_label")}
    taxLabel={requireSetting(snapshot, "tax.label")}
    maxHorizonDays={requireSetting(snapshot, "booking.max_horizon_days")}
    durationsHours={requireSetting(snapshot, "booking.durations_hours")}
    initialDate={date}
    addons={addonListing.addons.map((addon) => ({
      ...addon,
      imageAlt: describeImage(
        "booking.addons",
        addon.imagePath ?? "",
        [addon.name],
        "add-on",
      ),
    }))}
    onSubmit={createBooking}
  />;
}

type FrontDeskUpdateData = [
  Awaited<ReturnType<typeof listOpenAlerts>>,
  Awaited<ReturnType<typeof listTasks>>,
  Awaited<ReturnType<typeof listArrivals>>,
  Awaited<ReturnType<typeof listShiftNotes>>,
  Awaited<ReturnType<typeof listCleaningTasks>>,
  Awaited<ReturnType<typeof listStaff>>,
];

async function FrontDeskUpdates({ data, snapshot, date, today, userId }: {
  data: Promise<FrontDeskUpdateData>;
  snapshot: Awaited<ReturnType<typeof loadSettingsSnapshot>>;
  date: string;
  today: string;
  userId: string;
}) {
  const [alerts, tasks, arrivalListing, notes, cleaning, staff] = await data;
  const arrivals = arrivalListing.ok ? arrivalListing.arrivals : [];
  const todayWindow = dayWindow(snapshot, toCalendarDate(today));
  const severity = { critical: 0, warning: 1, info: 2 };
  return <DeskUpdates
        storageKey={`wellplace:desk-seen:${userId}:${today}`}
        items={{
          arrivals: arrivalListing.ok ? arrivals.filter((arrival) => arrival.status === "confirmed").map((arrival) => `${arrival.id}:${arrival.arrivedAt ?? "expected"}`) : null,
          alerts: alerts.ok ? alerts.alerts.map((alert) => `${alert.id}:${alert.openedAt}`) : null,
          notes: notes.ok ? notes.notes.filter((note) => note.authorId !== userId).map((note) => note.id) : null,
          tasks: tasks.ok && cleaning.ok ? [...tasks.tasks.map((task) => task.id), ...cleaning.tasks.filter((task) => task.status !== "confirmed").map((task) => `${task.id}:${task.status}:${task.assignedTo ?? "unassigned"}`)] : null,
        }}
        counts={{ notes: notes.ok ? notes.notes.length : null }}
        notes={notes.ok ? <ShiftNoteList notes={notes.notes} /> : <ConsoleReadError title="Notes could not be loaded" message={notes.message} remedy="Updates retry automatically." />}
        arrivals={<>          {todayWindow.status === "hours_unconfigured" ? (
            <ConsoleNotice Icon={TriangleAlertIcon}>Set opening hours in Management to load today’s arrivals.</ConsoleNotice>
          ) : !arrivalListing.ok ? <ConsoleReadError title="Arrivals could not be loaded" message={arrivalListing.message} remedy="Updates retry automatically. The arrival list is currently unknown." /> : <NextArrivalCard arrivals={arrivals} now={new Date().toISOString()} overdueAfterMinutes={requireSetting(snapshot, "reception.arrival_overdue_minutes")} />}</>}
        alerts={<>            {alerts.ok ? <AlertList alerts={alerts.alerts.toSorted((a, b) => severity[a.severity] - severity[b.severity])} resolvable /> : <ConsoleReadError title="Alerts could not be loaded" message={alerts.message} meaning="Updates retry automatically. The alert status is unknown." />}</>}
        tasks={<div className="flex flex-col gap-6"><ConsoleSection title="Your tasks" Icon={ListChecksIcon} action={<Button hoverEffect="sweep" asChild variant="ghost" size="sm"><Link href="/reception/tasks">All tasks</Link></Button>}>          {tasks.ok ? <TaskList tasks={tasks.tasks} actionable emptyMessage="You have no open tasks." /> : <ConsoleReadError title="Tasks could not be loaded" message={tasks.message} meaning="Updates retry automatically." />}</ConsoleSection>
          <ConsoleSection title="Cleaning work" Icon={SparklesIcon}>
            <p className="mb-3 text-micro text-text-secondary">Work records for {date}. To change the reserved cleaning time, tap a striped buffer on the schedule.</p>
            {!staff.ok && <ConsoleReadError title="Staff assignments could not be loaded" message={staff.message} />}
            {cleaning.ok ? <CleaningBoard tasks={cleaning.tasks} staff={staff.ok ? staff.items.filter((member) => member.isActive).map((member) => ({ id: member.id, fullName: member.fullName })) : []} overdueAfterMinutes={requireSetting(snapshot, "reception.cleaning_confirm_minutes")} now={new Date().toISOString()} /> : <ConsoleReadError title="Cleaning work could not be loaded" message={cleaning.message} />}
          </ConsoleSection>
        </div>}
  />;
}
