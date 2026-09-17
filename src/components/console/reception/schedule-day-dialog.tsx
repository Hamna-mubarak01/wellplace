"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDaysIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { BoardEntry, BoardSuite } from "./board-types";
import { OccupancyChip, chipDescription } from "./occupancy-chip";
import { ScheduleEntrySheet } from "./schedule-entry-sheet";
import { Button } from "@/components/shared/button";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/console/reception/reception-dialog";
import { SuiteDialogContent } from "@/components/console/suite-dialog-content";

export function ScheduleDayDialog({ date, entries, suites, suite, readOnly = false, onClose }: {
  date: string; entries: readonly BoardEntry[]; suites: readonly BoardSuite[]; suite?: BoardSuite; readOnly?: boolean; onClose: () => void;
}) {
  const [selected, setSelected] = useState<BoardEntry | null>(null);
  return <><Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><SuiteDialogContent>
    <DialogHeader className="border-b border-border bg-surface-raised p-5 pr-16 text-left"><DialogTitle className="font-body">{suite ? `Suite ${suite.suiteNumber}` : "Bookings and blocks"}</DialogTitle><DialogDescription>{format(parseISO(date), "EEEE, d MMMM yyyy")} · Dubai time</DialogDescription></DialogHeader>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      {!entries.length && <p className="py-5 text-console-body text-text-secondary">No bookings or blocks on this date.</p>}
      {entries.toSorted((a,b) => a.experienceStart.localeCompare(b.experienceStart)).map((entry) => <div key={entry.id} className="flex min-w-0 items-center gap-2"><span className="w-16 shrink-0 text-micro text-text-secondary">Suite {suites.find((row) => row.id === entry.suiteId)?.suiteNumber ?? "—"}</span><Button variant="ghost" aria-label={chipDescription(entry)} className="h-auto! min-h-tap min-w-0 flex-1 p-0" onClick={() => setSelected(entry)}><OccupancyChip entry={entry} className="min-h-16 w-full" /></Button></div>)}
    </div>
    <DialogFooter className="m-0! border-t border-border bg-surface-raised p-4"><Button variant="outline" hoverEffect="sweep" onClick={onClose}>Close</Button><Button asChild variant="outline"><Link href={`/reception?view=day&date=${date}${readOnly ? "&preview=1" : ""}`}><CalendarDaysIcon aria-hidden="true" className="size-4" />Open day schedule</Link></Button></DialogFooter>
  </SuiteDialogContent></Dialog>
    {selected && <ScheduleEntrySheet key={selected.id} entry={selected} suite={suites.find((row) => row.id === selected.suiteId)} readOnly={readOnly} onClose={() => setSelected(null)} />}
  </>;
}
