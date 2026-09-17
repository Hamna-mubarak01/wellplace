import Link from "next/link";
import { ArrivalCheckIn } from "@/components/console/reception/arrival-check-in";
import { CheckCircle2Icon, ClockIcon, PhoneIcon } from "lucide-react";

import type { ArrivalRow } from "@/lib/db/queries/bookings";
import { formatDubaiTime } from "@/lib/domain/time";
import { guestSummary } from "@/components/console/reception/booking-format";
import {
  ConsoleCard,
  ConsoleCardBody,
} from "@/components/console/console-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/shared/button";
import { Separator } from "@/components/ui/separator";

export interface NextArrivalCardProps {
  readOnly?: boolean;
  arrivals: readonly ArrivalRow[];
  now: string;
  overdueAfterMinutes: number;
}

export function NextArrivalCard({
  arrivals,
  readOnly = false,
  now,
  overdueAfterMinutes,
}: NextArrivalCardProps) {
  const instant = Date.parse(now);
  const expected = arrivals.filter((arrival) => arrival.status === "confirmed");
  const next = expected[0] ?? null;

  if (next === null) {
    return (
      <ConsoleCard className="h-full">
        <ConsoleCardBody className="flex h-full flex-col justify-center gap-2">
          <p className="text-console-label tracking-label text-text-muted uppercase">
            Next arrival
          </p>
          <div className="flex items-center gap-2">
            <CheckCircle2Icon
              aria-hidden="true"
              className="size-5 shrink-0 text-success"
            />
            <p className="text-console-body font-medium text-text-primary">
              No guests waiting to check in
            </p>
          </div>
          <p className="text-console-body text-text-secondary">
            {arrivals.length === 0
              ? "There are no bookings for today."
              : "Everyone expected today has checked in."}
          </p>
        </ConsoleCardBody>
      </ConsoleCard>
    );
  }

  const minutesLate = (instant - Date.parse(next.startsAt)) / 60_000;
  const overdue = minutesLate >= overdueAfterMinutes;

  return (
    <ConsoleCard className="h-full">
      <ConsoleCardBody className="flex h-full flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-console-label tracking-label text-text-muted uppercase">
            Next arrival
          </p>
          {overdue && (
            <Badge
              variant="outline"
              className="border-danger-border bg-danger-wash text-micro text-danger-ink"
            >
              <ClockIcon aria-hidden="true" className="size-3" />
              Overdue
            </Badge>
          )}
        </div>

        <p className="font-data text-console-title leading-none font-medium tabular-nums text-text-primary">
          {formatDubaiTime(next.startsAt)}
        </p>

        <div className="min-w-0">
          <p className="truncate text-console-body font-medium text-text-primary">
            {next.guestName}
          </p>
          <p className="text-console-body text-text-secondary">
            {guestSummary(next.adults, next.children)}
            {next.suiteNumber === null
              ? " · no suite secured"
              : ` · suite ${next.suiteNumber}`}
          </p>
        </div>

        {next.arrivedAt !== null && <p className="text-micro text-success-ink">Guest has arrived · ready for check-in</p>}
        {!readOnly && next.suiteNumber !== null && <ArrivalCheckIn bookingId={next.id} guestName={next.guestName} suiteNumber={next.suiteNumber} />}
        <Separator className="my-1" />

        {!readOnly && <div className="mt-auto flex flex-wrap items-center gap-2">
          <Button hoverEffect="sweep" asChild variant="outline" size="sm" className="font-data tabular-nums">
            <Link href={`/reception/bookings/${next.id}`}>Open booking</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="font-data tabular-nums">
            <a href={`tel:${next.guestPhone}`}>
              <PhoneIcon aria-hidden="true" className="size-4" />
              {next.guestPhone}
            </a>
          </Button>
        </div>}

        {expected.length > 1 && <div className="mt-3 border-t border-border pt-3">
          <h3 className="mb-2 text-micro font-medium text-text-muted">Also expected today</h3>
          <ul className="divide-y divide-border">{expected.slice(1).map((arrival) => <li key={arrival.id}>
            {readOnly ? <div className="flex items-center gap-3 py-3"><span className="font-data text-console-body">{formatDubaiTime(arrival.startsAt)}</span><span className="text-console-body">{arrival.guestName}</span></div> : <Button asChild variant="ghost" className="h-auto! min-h-tap w-full justify-start gap-3 px-0 py-3 text-left whitespace-normal"><Link href={`/reception/bookings/${arrival.id}`}><span className="shrink-0 font-data text-console-body">{formatDubaiTime(arrival.startsAt)}</span><span className="min-w-0"><span className="block text-console-body">{arrival.guestName}</span><span className="text-micro font-normal text-text-muted">{arrival.suiteNumber === null ? "No suite secured" : `Suite ${arrival.suiteNumber}`} · {guestSummary(arrival.adults, arrival.children)}</span></span></Link></Button>}
          </li>)}</ul>
        </div>}

      </ConsoleCardBody>
    </ConsoleCard>
  );
}
