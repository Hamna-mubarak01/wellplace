"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { BoardSuite, BoardEntry } from "./board-types";
import { OccupancyChip } from "./occupancy-chip";
import { ScheduleDayDialog } from "./schedule-day-dialog";
import { Button } from "@/components/shared/button";
import { SCHEDULE_PRESENTATION } from "@/lib/config/reception-display";
import { cn } from "@/lib/utils";

export function WeekSuiteSchedule({ suites, days, today, readOnly = false }: {
  suites: readonly BoardSuite[]; days: { date: string; entries: readonly BoardEntry[] }[]; today: string; readOnly?: boolean;
}) {
  const [selected, setSelected] = useState<{ date: string; suite: BoardSuite } | null>(null);
  const columns = `var(--measure-period-suite-label) repeat(${days.length}, minmax(0, 1fr))`;
  return <><div role="region" aria-label="Suite schedule by date" tabIndex={0} className="overflow-x-auto overscroll-x-contain rounded-(--radius-card) border border-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none">
    <div className="w-full" style={{ minWidth: `calc(var(--measure-period-suite-label) + ${days.length} * var(--measure-period-day))` }}>
      <div style={{ gridTemplateColumns: columns }} className="grid border-b border-border bg-surface-raised">
        <div className="sticky left-0 z-10 flex items-center border-r border-border bg-surface-raised px-3 text-console-label text-text-muted">Suite</div>
        {days.map((day) => <Button key={day.date} asChild variant="ghost" className="h-auto! min-h-tap rounded-none px-2 py-3"><Link href={`/reception?view=day&date=${day.date}${readOnly ? "&preview=1" : ""}`} aria-label={`Open ${format(parseISO(day.date),"EEEE d MMMM")}`} className={cn("flex flex-col gap-1", day.date === today && "bg-brand-wash")}><span className="text-console-body font-medium">{format(parseISO(day.date),"EEE d")}</span><span className="text-micro font-normal">{format(parseISO(day.date),"MMM")}{day.date === today ? " · Today" : ""}</span></Link></Button>)}
      </div>
      {suites.map((suite) => <div key={suite.id} style={{ gridTemplateColumns: columns }} className="grid border-b border-border last:border-b-0">
        <div className="sticky left-0 z-10 flex flex-col justify-center gap-1 border-r border-border bg-surface-raised px-3 py-2"><span className="text-console-body font-medium">Suite {suite.suiteNumber}</span></div>
        {days.map((day) => {
          const entries = day.entries.filter((entry) => entry.suiteId === suite.id).toSorted((a,b) => a.experienceStart.localeCompare(b.experienceStart));
          return <Button key={day.date} variant="ghost" onClick={() => setSelected({ date: day.date, suite })} className={cn("reception-week-cell h-auto! min-h-16 min-w-0 justify-start rounded-none border-r border-border p-2 text-left whitespace-normal last:border-r-0", day.date === today && "bg-brand-wash")} aria-label={`Suite ${suite.suiteNumber}, ${format(parseISO(day.date),"EEEE d MMMM")}, ${entries.length} entries`}><span className="flex w-full min-w-0 flex-col gap-1">{entries.length ? <>{entries.slice(0,SCHEDULE_PRESENTATION.weekPreviewCount).map((entry) => <OccupancyChip key={entry.id} entry={entry} compact className="h-auto py-1" />)}{entries.length > SCHEDULE_PRESENTATION.weekPreviewCount && <span className="text-micro font-normal text-text-secondary">+{entries.length-SCHEDULE_PRESENTATION.weekPreviewCount} more</span>}</> : <span className="text-micro font-normal text-text-muted">No entries</span>}</span></Button>;
        })}
      </div>)}
    </div>
  </div>{selected && <ScheduleDayDialog date={selected.date} suites={suites} suite={selected.suite} entries={(days.find((day) => day.date === selected.date)?.entries ?? []).filter((entry) => entry.suiteId === selected.suite.id)} readOnly={readOnly} onClose={() => setSelected(null)} />}</>;
}
