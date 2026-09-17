"use client";

import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/shared/button";
import { SuiteDialogContent } from "@/components/console/suite-dialog-content";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/console/reception/reception-dialog";
import { BOOKING_ACTIVITY_LABEL } from "@/lib/config/booking-list";
import { formatDubaiDateTime } from "@/lib/domain/time";
import type { Database } from "@/types/database.generated";

type BookingEvent = Database["public"]["Functions"]["reception_booking_audit"]["Returns"][number];

export function BookingHistory({ events }: { events: readonly BookingEvent[] }) {
  const [selected, setSelected] = useState<BookingEvent | null>(null);
  return <>
    {events.length === 0 ? <p className="text-console-body text-text-secondary">No recorded activity is available for this booking.</p> : <ol className="divide-y divide-border overflow-hidden rounded-(--radius-card) border border-border bg-surface-raised">
      {events.map((event) => <li key={event.event_id}>
        <Button type="button" variant="ghost" onClick={() => setSelected(event)} className="h-auto w-full justify-start gap-3 rounded-none px-4 py-4 text-left whitespace-normal">
          <span className="flex min-w-0 flex-1 flex-col gap-1"><span>{BOOKING_ACTIVITY_LABEL[event.action] ?? "Booking updated"}</span><span className="text-micro font-normal text-text-secondary">{event.actor_name || "System"}</span><time dateTime={event.occurred_at} className="text-micro font-normal text-text-secondary sm:hidden">{formatDubaiDateTime(event.occurred_at)}</time></span>
          <time dateTime={event.occurred_at} className="hidden text-micro font-normal text-text-secondary sm:block">{formatDubaiDateTime(event.occurred_at)}</time>
          <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0" />
        </Button>
      </li>)}
    </ol>}
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <SuiteDialogContent>
        <DialogHeader className="border-b border-border p-5 pr-12 text-left">
          <DialogTitle>{selected ? BOOKING_ACTIVITY_LABEL[selected.action] ?? "Booking updated" : "Booking activity"}</DialogTitle>
          <DialogDescription>Recorded booking and customer activity</DialogDescription>
        </DialogHeader>
        {selected && <dl className="grid gap-5 overflow-y-auto p-5 text-console-body">
          <div className="grid gap-1"><dt className="text-micro text-text-secondary">Performed by</dt><dd>{selected.actor_name || "System"}</dd></div>
          <div className="grid gap-1"><dt className="text-micro text-text-secondary">Time (Dubai)</dt><dd><time dateTime={selected.occurred_at}>{formatDubaiDateTime(selected.occurred_at)}</time></dd></div>
          <div className="grid gap-1"><dt className="text-micro text-text-secondary">Reason</dt><dd className="whitespace-pre-wrap wrap-anywhere">{selected.reason || "No reason was recorded for this action."}</dd></div>
        </dl>}
        <DialogFooter className="border-t border-border p-4"><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
      </SuiteDialogContent>
    </Dialog>
  </>;
}
