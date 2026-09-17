"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import type { BoardEntry, BoardSuite } from "./board-types";
import { ScheduleDayDialog } from "./schedule-day-dialog";
import { toneClassFor } from "./occupancy-chip";
import { SCHEDULE_PRESENTATION } from "@/lib/config/reception-display";
import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";

export interface PeriodDay { readonly isoDate: string; readonly label: string; readonly inPeriod: boolean; readonly disabled?: boolean; readonly isToday: boolean; readonly entries: readonly BoardEntry[] }
export interface PeriodGridProps { days: readonly PeriodDay[]; suiteCount: number; suites?: readonly BoardSuite[]; columns: 7; weekdayLabels: readonly string[]; readOnly?: boolean }

export function PeriodGrid({ days, suites = [], weekdayLabels, readOnly = false }: PeriodGridProps) {
  const [selected, setSelected] = useState<PeriodDay | null>(null);
  return <><div role="region" aria-label="Monthly bookings" tabIndex={0} className="overflow-x-auto rounded-(--radius-card) border border-border bg-surface-raised">
    <div className="reception-month-grid min-w-140">
      <div className="grid grid-cols-7 border-b border-border">{weekdayLabels.map((label) => <div key={label} className="px-3 py-2 text-console-label text-text-muted">{label}</div>)}</div>
      <div className="grid grid-cols-7">{days.map((day) => {
        const bookings = day.entries.filter((entry) => entry.bookingId).length;
        const blocks = day.entries.length - bookings;
        return <Button disabled={day.disabled} key={day.isoDate} variant="ghost" onClick={() => setSelected(day)} aria-label={`${format(parseISO(day.isoDate),"EEEE d MMMM")}, ${day.disabled ? "outside selected range" : `${bookings} bookings, ${blocks} other entries`}`} className={cn("reception-month-day h-auto! min-h-24 min-w-0 items-start justify-start rounded-none border-r border-b border-border p-2 text-left whitespace-normal", !day.inPeriod && "bg-surface-sunken")}>
          <span className="flex w-full min-w-0 flex-col gap-1"><span className={cn("flex items-center gap-1 text-console-table font-medium", day.isToday && "text-brand")}><span className={cn(day.isToday && "rounded-full bg-brand px-2 py-1 text-on-brand")}>{Number(day.label) === 1 ? format(parseISO(day.isoDate), "d MMM") : Number(day.label)}</span>{day.isToday && <span className="text-micro">Today</span>}</span>
          {!day.disabled && !!day.entries.length && <><span className="text-micro font-normal text-text-secondary">{bookings ? `${bookings} booking${bookings === 1 ? "" : "s"}` : `${blocks} block${blocks === 1 ? "" : "s"}`}</span>{day.entries.slice(0,SCHEDULE_PRESENTATION.monthPreviewCount).map((entry) => <span key={entry.id} className={cn("block truncate rounded-(--radius-inner) border px-2 py-1 text-micro font-normal", toneClassFor(entry))}>{entry.guestName || entry.reason || "Online hold"}</span>)}</>}
          </span>
        </Button>;
      })}</div>
    </div>
  </div>{selected && <ScheduleDayDialog date={selected.isoDate} entries={selected.entries} suites={suites} readOnly={readOnly} onClose={() => setSelected(null)} />}</>;
}
