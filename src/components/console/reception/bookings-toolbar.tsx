"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ListFilterIcon, XIcon } from "lucide-react";
import { ANY, BOOKING_SOURCE_LABEL, BOOKING_STATUS_LABEL, GUEST_TYPES, GUEST_TYPE_LABEL, PAYMENT_STATUS_LABEL, RECEPTION_PAYMENT_FILTERS, RECEPTION_SOURCE_FILTERS, type BookingSearchQuery } from "./booking-filters";
import { RECEPTION_BOOKING_STATUSES } from "@/lib/domain/booking";
import { ARRIVAL_FILTERS, ARRIVAL_FILTER_LABEL, BOOKING_LIST, BOOKING_PERIODS, BOOKING_PERIOD_LABEL, type BookingPeriod } from "@/lib/config/booking-list";
import { Button } from "@/components/shared/button";
import { ConsoleSearchInput } from "@/components/shared/console-search-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select";
import { BookingDateFilter } from "./booking-date-filter";

export interface SuiteOption { readonly id: string; readonly suiteNumber: number }
export interface BookingsToolbarProps { query: BookingSearchQuery; suites: readonly SuiteOption[]; total: number | null }
interface FilterDefinition { key: string; label: string; value: string; options: readonly { value: string; label: string }[] }

export function BookingsToolbar({ query, suites, total }: BookingsToolbarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [period, setPeriod] = useOptimistic(query.period);
  const [draft, setDraft] = useState({ source: query.search, value: query.search });
  if (draft.source !== query.search) {
    setDraft({ source: query.search, value: draft.value === draft.source ? query.search : draft.value });
  }
  const term = draft.value;
  const [open, setOpen] = useState(false);
  const serialised = params.toString();
  const navigation = useRef({ source: serialised, target: serialised });
  const push = useCallback((mutate: (next: URLSearchParams) => void) => {
    if (navigation.current.source !== serialised) navigation.current = { source: serialised, target: serialised };
    const next = new URLSearchParams(navigation.current.target);
    mutate(next); next.delete("page");
    navigation.current.target = next.toString();
    startTransition(() => router.replace(`/reception/bookings?${next}`, { scroll: false }));
  }, [router, serialised]);
  useEffect(() => {
    if (term.trim() === query.search) return;
    const timer = setTimeout(() => push((next) => { if (term.trim()) next.set("q", term.trim()); else next.delete("q"); }), BOOKING_LIST.searchDelayMs);
    return () => clearTimeout(timer);
  }, [term, query.search, push]);
  const setParam = (key: string, value: string) => push((next) => { if (key === "period") { next.delete("from"); next.delete("to"); } if (value === ANY || value === "all") next.delete(key); else next.set(key, value); });
  const filters: FilterDefinition[] = [
    { key: "arrival", label: "Arrival", value: query.arrival, options: ARRIVAL_FILTERS.map((value) => ({ value, label: ARRIVAL_FILTER_LABEL[value] })) },
    { key: "status", label: "Booking status", value: query.status, options: RECEPTION_BOOKING_STATUSES.map((value) => ({ value, label: BOOKING_STATUS_LABEL[value] })) },
    { key: "payment", label: "Payment", value: query.paymentStatus, options: RECEPTION_PAYMENT_FILTERS.map((value) => ({ value, label: PAYMENT_STATUS_LABEL[value] })) },
    { key: "source", label: "Source", value: query.source, options: RECEPTION_SOURCE_FILTERS.map((value) => ({ value, label: BOOKING_SOURCE_LABEL[value] })) },
    { key: "guests", label: "Guests", value: query.guestType, options: GUEST_TYPES.map((value) => ({ value, label: GUEST_TYPE_LABEL[value] })) },
    { key: "suite", label: "Suite", value: query.suiteId, options: suites.map((suite) => ({ value: suite.id, label: `Suite ${suite.suiteNumber}` })) },
  ];
  const active = filters.filter((filter) => filter.value !== ANY);
  const anythingSet = active.length > 0 || !!query.search || !!query.from;
  return <div className="flex min-w-0 flex-col gap-3 rounded-(--radius-card) border border-border bg-surface-raised p-3 sm:p-4" aria-busy={pending}>
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <div className="flex min-w-0 flex-1 basis-64"><ConsoleSearchInput label="Search bookings" placeholder="Guest, phone or email" value={term} onChange={(value) => setDraft({ source: query.search, value })} /></div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button type="button" variant="outline" size="sm" hoverEffect="simple"><ListFilterIcon aria-hidden="true" className="size-4" />Filters{active.length > 0 ? ` (${active.length})` : ""}</Button></PopoverTrigger>
        <PopoverContent align="end" collisionPadding={8} className="density-console w-80 max-w-(--radix-popover-content-available-width) max-h-(--radix-popover-content-available-height) overflow-y-auto">
          <div className="mb-3 flex items-center justify-between gap-2"><p className="font-medium">Filter bookings</p>{active.length > 0 && <Button variant="ghost" size="sm" hoverEffect="simple" onClick={() => push((next) => filters.forEach((filter) => next.delete(filter.key)))}>Clear filters</Button>}</div>
          <div className="grid gap-3">{filters.map((filter) => <div key={filter.key} className="grid min-w-0 gap-1"><Label htmlFor={`booking-filter-${filter.key}`}>{filter.label}</Label><Select value={filter.value} onValueChange={(value) => setParam(filter.key, value)}><SelectTrigger id={`booking-filter-${filter.key}`} className="h-tap! w-full"><SelectValue /></SelectTrigger><SelectContent className="density-console reception-menu"><SelectItem value={ANY}>Any</SelectItem>{filter.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>)}</div>
        </PopoverContent>
      </Popover>
    </div>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <Tabs value={period} onValueChange={(value) => startTransition(() => { setPeriod(value as BookingPeriod); setParam("period", value); })} className="min-w-0 max-sm:w-full"><TabsList aria-label="Booking period" className="grid h-auto! w-full grid-cols-2 gap-1 p-1">{BOOKING_PERIODS.map((period) => <TabsTrigger key={period} value={period} className="h-auto! min-h-tap whitespace-nowrap px-2 sm:px-4">{BOOKING_PERIOD_LABEL[period]}</TabsTrigger>)}</TabsList></Tabs>
      <BookingDateFilter from={query.from} to={query.to} onApply={(from, to) => push((next) => { next.delete("period"); if (from) { next.set("from", from); next.set("to", to ?? from); } else { next.delete("from"); next.delete("to"); } })} />
    </div>
    {anythingSet && <div className="flex flex-wrap items-center gap-2">{active.map((filter) => <Button key={filter.key} variant="secondary" hoverEffect="simple" size="sm" className="max-w-full" aria-label={`Remove ${filter.label.toLowerCase()} filter`} onClick={() => setParam(filter.key, ANY)}><span className="truncate">{filter.label}: {filter.options.find((option) => option.value === filter.value)?.label}</span><XIcon aria-hidden="true" className="size-4" /></Button>)}<Button variant="ghost" size="sm" hoverEffect="simple" onClick={() => { setDraft({ source: query.search, value: "" }); push((next) => { for (const key of [...next.keys()]) next.delete(key); }); }}>Clear all filters</Button></div>}
    <p role="status" className="sr-only">{pending ? "Updating bookings…" : total === null ? "Bookings unavailable" : "Bookings updated"}</p>
  </div>;
}
