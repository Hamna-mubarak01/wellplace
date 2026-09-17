"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarDaysIcon } from "lucide-react";
import { Button } from "@/components/shared/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { todayInDubai } from "@/lib/domain/time";

export function BookingDateFilter({ from, to, onApply }: { from?: string; to?: string; onApply: (from?: string, to?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("date");
  const [range, setRange] = useState<DateRange | undefined>();
  const anchor = parseISO(from ?? todayInDubai());
  const label = from ? to && to !== from ? `${format(anchor, "d MMM yyyy")} – ${format(parseISO(to), "d MMM yyyy")}` : format(anchor, "d MMM yyyy") : "All dates";
  return <Popover open={open} onOpenChange={(value) => { setOpen(value); if (value) { setMode(from && to !== from ? "range" : "date"); setRange(from ? { from: anchor, to: parseISO(to ?? from) } : undefined); } }}>
    <PopoverTrigger asChild><Button variant="outline" size="sm" hoverEffect="simple" aria-label="Filter by booking date" className="max-w-full"><CalendarDaysIcon className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{label}</span></Button></PopoverTrigger>
    <PopoverContent align="start" collisionPadding={8} className="density-console reception-date-picker w-auto max-w-(--radix-popover-content-available-width) max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-contain p-2">
      <Tabs value={mode} onValueChange={(value) => { setMode(value); setRange(undefined); }}><TabsList className="grid h-auto! w-full grid-cols-2"><TabsTrigger className="min-h-tap" value="date">Single date</TabsTrigger><TabsTrigger className="min-h-tap" value="range">Date range</TabsTrigger></TabsList></Tabs>
      {mode === "date" ? <Calendar mode="single" weekStartsOn={1} defaultMonth={anchor} selected={from ? anchor : undefined} className="[--cell-size:var(--spacing-tap)]" onSelect={(value) => { if (value) { const date = format(value, "yyyy-MM-dd"); onApply(date, date); setOpen(false); } }} /> : <>
        <Calendar mode="range" weekStartsOn={1} defaultMonth={anchor} selected={range} onSelect={setRange} className="[--cell-size:var(--spacing-tap)]" />
        <Button className="mb-2 w-full" disabled={!range?.from || !range.to} onClick={() => { if (range?.from && range.to) { onApply(format(range.from, "yyyy-MM-dd"), format(range.to, "yyyy-MM-dd")); setOpen(false); } }}>Show date range</Button>
      </>}
      <Button variant="ghost" hoverEffect="simple" className="w-full" onClick={() => { onApply(); setOpen(false); }}>All dates</Button>
    </PopoverContent>
  </Popover>;
}
