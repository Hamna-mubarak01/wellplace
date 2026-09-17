"use client";

import { addDays, format, parseISO } from "date-fns";
import { ScheduleToolbar } from "./schedule-toolbar";
import { WeekSuiteSchedule } from "./week-suite-schedule";
import { PeriodGrid } from "./period-grid";
import type { BoardView } from "./board-view-config";
import { monthSelection, weekRange } from "@/lib/console/schedule-range";
import { useState } from "react";
import Link from "next/link";
import { BellPlusIcon, ArrowLeftIcon } from "lucide-react";
import { formatDubaiDateTime } from "@/lib/domain/time";
import { RECEPTION_PREVIEW, receptionPreviewData } from "@/lib/config/reception-preview";
import { Button } from "@/components/shared/button";
import { ConsoleSearchInput } from "@/components/shared/console-search-input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeskWorkspace } from "@/components/console/reception/desk-workspace";
import { TimelineZoomProvider } from "@/components/console/reception/timeline-zoom";
import { SuiteTimeline } from "@/components/console/reception/suite-timeline";
import { BoardLegend } from "@/components/console/reception/board-legend";
import { NextArrivalCard } from "@/components/console/reception/next-arrival-card";

export function FrontDeskPreview({ date, userId, view = "day", endDate }: { date: string; userId: string; view?: BoardView; endDate?: string }) {
  const { board, arrivals } = receptionPreviewData(date);
  const anchor = parseISO(date);
  const month = monthSelection(date, endDate);
  const range = view === "month" ? month.calendar : weekRange(date);
  const days = range.days.map((nextDate) => ({ date: nextDate, entries: receptionPreviewData(nextDate).board.entries }));
  const [query, setQuery] = useState("");
  const [updates, setUpdates] = useState<{ id: string; author: string; time: string; body: string }[]>([]);
  const notes = [...updates, ...RECEPTION_PREVIEW.notes];
  const visible = { ...board, openingWindow: board.window, window: {start:new Date(`${date}T00:00:00+04:00`).toISOString(),end:new Date(`${format(addDays(anchor,1),"yyyy-MM-dd")}T00:00:00+04:00`).toISOString()}, entries: board.entries.filter((entry) => `${entry.guestName ?? ""} ${entry.bookingReference ?? ""} ${entry.reason ?? ""} ${entry.guestEmail ?? ""} ${entry.guestPhone ?? ""}`.toLowerCase().includes(query.toLowerCase())) };
  return <div className="reception-front flex min-w-0 flex-col gap-3 p-3 sm:p-4 lg:px-6">
    <h1 className="sr-only">Front desk</h1>
    <DeskWorkspace
      storageKey={`wellplace:desk-preview:${userId}:${date}`}
      items={{ arrivals: arrivals.map((arrival) => arrival.id), alerts: ["payment-link", "suite-seven"], notes: notes.map((note) => note.id), tasks: ["linen-stock"] }}
      toolbar={
        <ConsoleSearchInput label="Find a booking" placeholder="Guest, phone or email" value={query} onChange={setQuery} />
      }
      actions={<>
        <Button hoverEffect="sweep" variant="outline" size="sm" onClick={() => setUpdates((current) => [{ id: crypto.randomUUID(), author: "Laila Hassan", time: "14:00", body: "The evening linen delivery has arrived. Please check the cupboard before the next shift starts." }, ...current])}><BellPlusIcon aria-hidden="true" className="size-4" />New update</Button>
        <Button hoverEffect="sweep" asChild variant="ghost" size="sm"><Link href="/reception"><ArrowLeftIcon aria-hidden="true" className="size-4" />Live front desk</Link></Button>
      </>}
      arrivals={<NextArrivalCard readOnly arrivals={arrivals} now={`${date}T13:30:00+04:00`} overdueAfterMinutes={RECEPTION_PREVIEW.overdueAfterMinutes} />}
      alerts={<div className="space-y-3"><UpdateCard label="Payment link waiting" detail="Zara Malik · Suite 3 · 16:00. Check the payment before the reservation expires." /><UpdateCard label="Maintenance visit" detail="Suite 7 is reserved for equipment service from 13:00 to 16:00." /></div>}
      notes={<ul className="space-y-3">{notes.map((note) => <li key={note.id}><Card className="gap-0 py-0"><CardContent className="space-y-3 p-4"><Badge variant="outline">Waiting for handover</Badge><p className="text-console-body text-text-primary">{note.body}</p><p className="text-micro text-text-muted">{note.author} · {formatDubaiDateTime(`${date}T${note.time}:00+04:00`)}</p></CardContent></Card></li>)}</ul>}
      tasks={<UpdateCard label="Check linen stock" detail="Count the towels and robes in the reception cupboard before the evening shift. Assigned to you · Due today." />}
    >
      <TimelineZoomProvider durationsHours={RECEPTION_PREVIEW.durationsHours} openingMinutes={(Date.parse(board.window.end) - Date.parse(board.window.start)) / 60_000}>
      <div className="flex min-w-0 flex-col gap-3 rounded-(--radius-card) border border-border bg-surface-raised p-3">
        <ScheduleToolbar view={view} date={date} step={view === "week" ? 7 : month.selected?.days.length ?? 1} endDate={view === "month" ? month.selected?.to : undefined} preview />
        {view === "month" ? <PeriodGrid columns={7} suites={board.suites} suiteCount={board.suites.length} weekdayLabels={["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]} days={days.map((day) => ({isoDate:day.date,label:day.date.slice(8),inPeriod:month.selected ? day.date>=month.selected.from && day.date<=month.selected.to : day.date.slice(0,7)===date.slice(0,7),disabled:month.selected !== null && (day.date<month.selected.from || day.date>month.selected.to),isToday:day.date===date,entries:day.entries}))} readOnly /> : view === "week" ? <WeekSuiteSchedule suites={board.suites} days={days} today={date} readOnly /> : <SuiteTimeline board={visible} intervalMinutes={RECEPTION_PREVIEW.intervalMinutes} readOnly />}
        <BoardLegend />
      </div>
      </TimelineZoomProvider>
    </DeskWorkspace>
  </div>;
}

function UpdateCard({ label, detail }: { label: string; detail: string }) {
  return <Card className="gap-0 py-0"><CardContent className="space-y-2 p-4"><h3 className="text-console-body font-medium text-text-primary">{label}</h3><p className="text-console-body text-text-secondary">{detail}</p></CardContent></Card>;
}
