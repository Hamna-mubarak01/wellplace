"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO, addDays, differenceInCalendarDays, startOfWeek, endOfWeek } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { todayInDubai } from "@/lib/domain/time";
import { SCHEDULE_PRESENTATION } from "@/lib/config/reception-display";
import type { BoardView } from "./board-view-config";
import { Button } from "@/components/shared/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
export interface BoardDateNavProps { view: BoardView; date: string; today?: string; step: number; endDate?: string; preview?: boolean }

export function BoardDateNav({ view, date, today, step, endDate, preview = false }: BoardDateNavProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("date");
  const [range, setRange] = useState<DateRange | undefined>();
  const suffix = preview ? "&preview=1" : "";
  const activeRange = view === "month" && endDate !== undefined;
  const href = (target: string, end?: string, targetView = view) => `/reception?view=${targetView}&date=${target}${end ? `&to=${end}` : ""}${suffix}`;
  const navigate = (target: string) => {
    setOpen(false);
    start(() => router.push(target, { scroll: false }));
  };
  const shift = (direction: number) => {
    if (view !== "month" || activeRange) return shiftIsoDate(date, step * direction);
    const [year, month] = date.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1 + direction, 1)).toISOString().slice(0, 10);
  };
  const anchor = parseISO(date);
  const label = activeRange
    ? `${format(anchor, "d MMM")} – ${format(parseISO(endDate), "d MMM yyyy")}`
    : view === "month" ? format(anchor, "MMMM yyyy")
    : view === "week" ? `${format(startOfWeek(anchor, { weekStartsOn: 1 }), "d MMM")} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), "d MMM yyyy")}`
    : format(anchor, "EEE, d MMM yyyy");
  const periodLabel = activeRange ? "range" : view === "week" ? "week" : view === "month" ? "month" : "day";
  const validRange = range?.from && range.to && differenceInCalendarDays(range.to, range.from) >= 0 && differenceInCalendarDays(range.to, range.from) < SCHEDULE_PRESENTATION.maxRangeDays;
  return <div role="group" aria-label="Schedule date" data-reception-navigating={pending} className="reception-schedule-date flex min-w-0 items-center gap-1">
    <Button asChild variant="outline" size="icon"><Link scroll={false} href={href(shift(-1), activeRange ? shiftIsoDate(endDate, -step) : undefined)} aria-label={`Previous ${periodLabel}`}><ChevronLeftIcon aria-hidden="true" className="size-4" /></Link></Button>
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) { setMode(activeRange ? "range" : "date"); setRange(activeRange ? { from: anchor, to: parseISO(endDate) } : undefined); }
    }}>
      <PopoverTrigger asChild><Button variant="outline" size="sm" aria-label="Choose schedule date or range" className="min-w-0 flex-1 gap-2 px-2 sm:flex-none"><CalendarDaysIcon aria-hidden="true" className="size-4 shrink-0" /><span className="truncate">{label}</span></Button></PopoverTrigger>
      <PopoverContent align="start" collisionPadding={8} className="density-console reception-date-picker w-auto max-w-(--radix-popover-content-available-width) max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-contain p-2">
        <Tabs value={mode} onValueChange={setMode}><TabsList className="grid h-auto! w-full grid-cols-2"><TabsTrigger className="min-h-tap" value="date">Single date</TabsTrigger><TabsTrigger className="min-h-tap" value="range">Date range</TabsTrigger></TabsList></Tabs>
        {mode === "date" ? <Calendar mode="single" required weekStartsOn={1} selected={anchor} defaultMonth={anchor} className="[--cell-size:var(--spacing-tap)]" onSelect={(next) => { if (next) navigate(href(format(next, "yyyy-MM-dd"))); }} /> : <>
          <Calendar mode="range" weekStartsOn={1} selected={range} defaultMonth={anchor} max={SCHEDULE_PRESENTATION.maxRangeDays - 1} disabled={range?.from && !range.to ? { after: addDays(range.from, SCHEDULE_PRESENTATION.maxRangeDays - 1) } : undefined} onSelect={setRange} className="[--cell-size:var(--spacing-tap)]" />
          <p className="px-2 text-micro text-text-secondary">Choose a start and end date, up to {SCHEDULE_PRESENTATION.maxRangeDays} days.</p>
          <Button className="mt-3 w-full" disabled={!validRange || pending} onClick={() => {
            if (range?.from && range.to && validRange) {
              const from = format(range.from, "yyyy-MM-dd"), to = format(range.to, "yyyy-MM-dd");
              navigate(href(from, from === to ? undefined : to, "month"));
            }
          }}>Apply date range</Button>
        </>}
        {(activeRange || range?.from) && <Button hoverEffect="sweep" variant="ghost" className="mt-2 w-full" onClick={() => { setRange(undefined); navigate(href(date, undefined, "month")); }}>Clear date range</Button>}
      </PopoverContent>
    </Popover>
    <Button asChild variant="outline" size="icon"><Link scroll={false} href={href(shift(1), activeRange ? shiftIsoDate(endDate, step) : undefined)} aria-label={`Next ${periodLabel}`}><ChevronRightIcon aria-hidden="true" className="size-4" /></Link></Button>
    <Button hoverEffect="sweep" asChild variant="ghost" size="sm" className="px-2"><Link scroll={false} href={href(today ?? todayInDubai())}>Today</Link></Button>
    {pending && <span role="status" className="sr-only">Loading schedule…</span>}
  </div>;
}
