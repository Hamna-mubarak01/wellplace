"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarSearchIcon } from "lucide-react";

import type { BookingRow } from "@/lib/db/queries/bookings";
import { Card, CardContent } from "@/components/ui/card";
import { ConsoleEmpty } from "@/components/console/console-surface";
import {
  guestSummary,
  sourceLabel,
} from "@/components/console/reception/booking-format";
import { DUBAI_TIME_ZONE, formatDubaiTime } from "@/lib/domain/time";
import { formatAed } from "@/components/shared/money";
import { BookingStatusBadge } from "@/components/console/reception/booking-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface BookingsTableProps {
  rows: readonly BookingRow[];
  filtered: boolean;
}

export function BookingsTable({ rows, filtered }: BookingsTableProps) {
  const router = useRouter();
  if (rows.length === 0) {
    return (
      <ConsoleEmpty
        Icon={CalendarSearchIcon}
        title={filtered ? "No bookings match those filters" : "No bookings yet"}
        description={
          filtered
            ? "Clear a filter, or search by name, mobile or email."
            : "Walk-ins and online bookings will appear here as they are made."
        }
      />
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 gap-3 sm:hidden">
      {rows.map((row) => <Link key={row.id} href={`/reception/bookings/${row.id}`} aria-label={`Open ${row.guestName || "guest"}, details and history`} className="min-w-0 rounded-(--radius-card) focus-visible:outline-2 focus-visible:outline-ring">
        <Card className="gap-0 py-0 transition-colors hover:bg-surface-hover"><CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{row.guestName || "Guest name unavailable"}</p></div><BookingStatusBadge status={row.status} /></div>
          <div className="flex flex-wrap justify-between gap-2 text-micro"><div><p>{new Intl.DateTimeFormat("en-GB", { timeZone: DUBAI_TIME_ZONE, day: "numeric", month: "short", year: "numeric" }).format(new Date(row.startsAt))}</p><p className="font-data">{formatDubaiTime(row.startsAt)} – {formatDubaiTime(row.endsAt)}</p></div><div className="text-right"><p>{row.suiteNumber === null ? "Suite not secured" : `Suite ${row.suiteNumber}`}</p><p>{guestSummary(row.adults, row.children)}</p></div></div>
          <p className="truncate text-micro text-text-secondary">{row.guestEmail || row.guestPhone || "Contact not provided"}</p>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-micro text-text-secondary"><span>{sourceLabel(row.source)}</span><span className="font-data">{row.totalFils === null ? "—" : formatAed(row.totalFils)}</span></div>
        </CardContent></Card>
      </Link>)}
    </div>
    <div className="hidden sm:block overflow-x-auto rounded-(--radius-card) border border-border bg-surface-raised">
      <Table className="reception-bookings-table min-w-240 table-fixed text-console-table [&_th]:px-5 [&_th]:py-3 [&_td]:px-5 [&_td]:py-4 [&_td]:whitespace-normal">
        <colgroup><col style={{ width: "28%" }} /><col style={{ width: "26%" }} /><col style={{ width: "8%" }} /><col style={{ width: "23%" }} /><col style={{ width: "15%" }} /></colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Guest</TableHead>
            <TableHead>Visit <span className="font-normal text-text-muted">(Dubai time)</span></TableHead>
            <TableHead className="text-center">Suite</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="cursor-pointer transition-colors hover:bg-surface-hover focus-within:bg-surface-hover" onClick={(event) => { if (!(event.target as HTMLElement).closest("a,button") && !window.getSelection()?.toString()) router.push(`/reception/bookings/${row.id}`); }}>
              <TableCell className="min-w-0">
                <Link href={`/reception/bookings/${row.id}`} className="inline-flex min-h-tap flex-col justify-center font-medium text-text-primary hover:text-brand focus-visible:outline-2 focus-visible:outline-ring rounded-sm" aria-label={`Open ${row.guestName || "guest"}, details and history`}>
                  <span className="line-clamp-1">{row.guestName || "Guest name unavailable"}</span>
                </Link>
                <span className="block truncate text-micro text-text-secondary">{row.guestEmail || row.guestPhone || "Contact not provided"}</span>
              </TableCell>
              <TableCell>
                <span className="block font-data text-micro whitespace-nowrap">{new Intl.DateTimeFormat("en-GB", { timeZone: DUBAI_TIME_ZONE, day: "numeric", month: "short", year: "numeric" }).format(new Date(row.startsAt))}</span>
                <span className="block font-data text-micro whitespace-nowrap">{formatDubaiTime(row.startsAt)} – {formatDubaiTime(row.endsAt)}</span>
                <span className="block text-micro text-text-secondary">{guestSummary(row.adults, row.children)} · {sourceLabel(row.source)}</span>
              </TableCell>
              <TableCell className="text-center font-data tabular-nums">
                {row.suiteNumber === null ? <span className="text-danger-ink">Not secured</span> : row.suiteNumber}
              </TableCell>
              <TableCell>
                <BookingStatusBadge status={row.status} />
                <span className="mt-1 block text-micro text-text-secondary">{row.checkedOutAt ? "Checked out" : row.checkedInAt ? "In suite" : row.arrivedAt ? "Arrived · awaiting check-in" : row.status === "confirmed" ? "Awaiting arrival" : ""}</span>
              </TableCell>
              <TableCell className="text-right font-data tabular-nums whitespace-nowrap!">
                {row.totalFils === null ? "—" : formatAed(row.totalFils)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </>
  );
}
