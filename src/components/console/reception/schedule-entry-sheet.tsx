"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MoveIcon, ExternalLinkIcon, UsersIcon, PhoneIcon, MailIcon, ClockIcon, ShoppingBagIcon, StickyNoteIcon, CreditCardIcon, GlobeIcon } from "lucide-react";
import { loadScheduleBooking } from "@/app/(console)/reception/schedule-details";
import type { BoardEntry, BoardSuite } from "./board-types";
import { BOARD_STATE_LABEL } from "./board-types";
import { isMovable } from "./board-drag";
import { formatDubaiDateTime, formatDubaiTime } from "@/lib/domain/time";
import { PAYMENT_STATUS_LABEL } from "./booking-filters";
import { guestSummary, sourceLabel } from "./booking-format";
import { formatAed } from "@/components/shared/money";
import { ScheduleBufferDialog } from "./schedule-buffer-dialog";
import { ArrivalCheckIn } from "./arrival-check-in";
import { toneClassFor } from "./occupancy-chip";
import { Button } from "@/components/shared/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/console/reception/reception-dialog";
import { SuiteDialogContent } from "@/components/console/suite-dialog-content";

type Details = Awaited<ReturnType<typeof loadScheduleBooking>>;

export function ScheduleEntrySheet({ entry, suite, onClose, onMove, readOnly = false }: {
  readOnly?: boolean; entry: BoardEntry; suite?: BoardSuite; onClose: () => void; onMove?: () => void;
}) {
  const [bufferOpen, setBufferOpen] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [retry, setRetry] = useState(0);
  const blocked = entry.state === "block" || entry.state === "maintenance";
  useEffect(() => {
    if (readOnly || !entry.bookingId) return;
    let active = true;
    loadScheduleBooking(entry.bookingId).then((result) => { if (active) setDetails(result); }).catch(() => { if (active) setDetails({ outcome: "failed", message: "Booking details could not be loaded. Please try again." }); });
    return () => { active = false; };
  }, [entry.bookingId, readOnly, retry]);
  const booking = details?.outcome === "found" ? details.booking : entry.detail ?? null;
  const changes = details?.outcome === "found" ? details.changes : null;
  const email = booking?.guestEmail ?? entry.guestEmail;
  const phone = booking?.guestPhone ?? entry.guestPhone;
  const adults = booking?.adults ?? entry.adults;
  const children = booking?.children ?? entry.children ?? 0;
  const title = entry.guestName || entry.reason || (entry.state === "hold" ? "Online hold" : BOARD_STATE_LABEL[entry.state]);
  return <>
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SuiteDialogContent className="reception-entry-dialog">
        <DialogHeader className="shrink-0 border-b border-border bg-surface-raised p-5 pr-16 text-left">
          <div className="flex flex-wrap items-center gap-2"><DialogTitle className="font-body wrap-anywhere text-console-title">{title}</DialogTitle><Badge variant="outline" className={toneClassFor(entry)}>{BOARD_STATE_LABEL[entry.state]}</Badge></div>
          <DialogDescription className="font-data text-micro">Suite {suite?.suiteNumber ?? "—"} · {formatDubaiTime(entry.experienceStart)}–{formatDubaiTime(entry.experienceEnd)}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          <dl className="flex flex-col gap-4">
            {!blocked && <>
              <Item Icon={UsersIcon} label="Guests">{adults === undefined ? "Not provided" : guestSummary(adults, children)}{booking?.guests.some((guest) => guest.kind === "child" && guest.age !== null) && <span className="mt-1 block text-micro text-text-secondary">Child ages: {booking.guests.filter((guest) => guest.kind === "child").map((guest) => guest.age).join(", ")}</span>}</Item>
              <Item Icon={PhoneIcon} label="Phone">{phone ? <a className="break-all underline underline-offset-4" href={`tel:${phone}`}>{phone}</a> : entry.detailsUnavailable ? "Unavailable" : "Not provided"}</Item>
              <Item Icon={MailIcon} label="Email">{email ? <a className="break-all underline underline-offset-4" href={`mailto:${email}`}>{email}</a> : entry.detailsUnavailable ? "Unavailable" : "Not provided"}</Item>
            </>}
            <Item Icon={ClockIcon} label={blocked ? "Blocked from" : "Starts"}>{formatDubaiDateTime(entry.experienceStart)}</Item>
            <Item Icon={ClockIcon} label={blocked ? "Blocked until" : "Ends"}>{formatDubaiDateTime(entry.experienceEnd)}</Item>
            {!blocked && <Item Icon={ClockIcon} label="Cleaning ends">{formatDubaiDateTime(entry.blockedEnd)}{!readOnly && entry.bookingId && <Button type="button" variant="link" className="ml-3" onClick={() => setBufferOpen(true)}>Edit cleaning time</Button>}</Item>}
            {entry.holdExpiresAt && <Item Icon={ClockIcon} label="Hold expires">{formatDubaiDateTime(entry.holdExpiresAt)}</Item>}
            {booking && <>
              <Item Icon={CreditCardIcon} label="Payment status">{entry.paymentStatus ? PAYMENT_STATUS_LABEL[entry.paymentStatus] : "Not recorded"}</Item>
              <Item Icon={CreditCardIcon} label="Booking total">{booking.totalFils === null ? "Not available" : formatAed(booking.totalFils)}</Item>
              <Item Icon={GlobeIcon} label="Booked via">{sourceLabel(booking.source)}</Item>
              <Item Icon={ShoppingBagIcon} label="Add-ons">{booking.addons.length ? booking.addons.map((addon) => `${addon.name} ×${addon.quantity}`).join(", ") : "No add-ons"}</Item>
            </>}
            {entry.reason && <Item Icon={StickyNoteIcon} label={blocked ? "Reason" : "Note"}>{entry.reason}</Item>}
            {changes?.ok && changes.events.map((change) => <Item key={change.event_id} Icon={StickyNoteIcon} label={change.action === "move_booking" ? "Move reason" : change.action === "extend_booking" ? "Extension reason" : "Rescheduling reason"}><span>{change.reason}</span><span className="mt-1 block text-micro text-text-muted">{change.actor_name} · {formatDubaiDateTime(change.occurred_at)}</span></Item>)}
            {suite?.internalNote && <Item Icon={StickyNoteIcon} label="Suite note">{suite.internalNote}</Item>}
          </dl>
          {booking && [booking.warningNote, booking.personalRequest, booking.internalNote].map((note, index) => note && <div key={index} className="mt-4 rounded-(--radius-control) border border-warning-border bg-warning-wash p-3 text-console-body text-warning-ink"><p className="mb-1 font-medium">{["Guest warning", "Guest request", "Staff note"][index]}</p><p className="whitespace-pre-wrap wrap-anywhere">{note}</p></div>)}
          {changes && !changes.ok && <div role="alert" className="mt-4 text-console-body text-danger-ink"><p>{changes.message}</p><Button hoverEffect="sweep" variant="outline" size="sm" onClick={() => { setDetails(null); setRetry((value) => value + 1); }}>Try again</Button></div>}
          {!readOnly && entry.bookingId && !details && <div role="status" className="mt-4 space-y-2"><span className="text-micro text-text-muted">Loading booking details…</span><Skeleton className="h-12 w-full" /></div>}
          {details?.outcome === "failed" && <div role="alert" className="mt-4 text-console-body text-danger-ink"><p>{details.message}</p><Button hoverEffect="sweep" variant="outline" size="sm" onClick={() => { setDetails(null); setRetry((value) => value + 1); }}>Try again</Button></div>}
        </div>
        <DialogFooter className="reception-entry-actions m-0! shrink-0 border-t border-border bg-surface-raised p-4">
          {!readOnly && entry.bookingId && entry.state === "booked" && suite && <ArrivalCheckIn className="col-span-2" bookingId={entry.bookingId} guestName={title} suiteNumber={suite.suiteNumber} />}
          {!readOnly && entry.bookingId && <Button asChild className={entry.state === "booked" ? undefined : "col-span-2"} variant={entry.state === "booked" ? "outline" : "default"}><Link href={`/reception/bookings/${entry.bookingId}`}><ExternalLinkIcon aria-hidden="true" className="size-4" />Open booking</Link></Button>}
          {!readOnly && onMove && isMovable(entry) && <Button variant="outline" hoverEffect="sweep" onClick={onMove}><MoveIcon aria-hidden="true" className="size-4" />Move</Button>}
          {phone && <Button asChild variant="outline" hoverEffect="sweep"><a href={`tel:${phone}`}><PhoneIcon aria-hidden="true" className="size-4" />Call</a></Button>}
          <Button variant="outline" hoverEffect="sweep" onClick={onClose}>Close</Button>
        </DialogFooter>
      </SuiteDialogContent>
    </Dialog>
    {bufferOpen && entry.bookingId && <ScheduleBufferDialog bookingId={entry.bookingId} onClose={() => setBufferOpen(false)} />}
  </>;
}

function Item({ label, children, Icon }: { label: string; children: React.ReactNode; Icon: typeof ClockIcon }) {
  return <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 sm:grid-cols-[auto_7rem_minmax(0,1fr)]"><Icon aria-hidden="true" className="mt-1 size-4 text-text-muted" /><dt className="text-micro text-text-muted sm:pt-1">{label}</dt><dd className="col-start-2 min-w-0 whitespace-pre-wrap wrap-anywhere text-console-body text-text-primary sm:col-start-3">{children}</dd></div>;
}
