import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDaysIcon } from "lucide-react";

import { DetailSection } from "@/components/console/shared/detail-section";
import { DetailFieldGrid } from "@/components/console/shared/detail-field-grid";
import { DetailField } from "@/components/console/shared/detail-field";
import { Separator } from "@/components/ui/separator";
import {
  childAgesLabel,
  durationLabel,
  guestsLabel,
  sourceLabel,
  suiteLabel,
  visitMinutes,
} from "@/components/console/manage/bookings/booking-model";
import type { BookingDetail } from "@/lib/db/queries/bookings";
import { DUBAI_TIME_ZONE, formatDubaiDateTime, formatDubaiTime } from "@/lib/domain/time";
import { suitePath } from "@/app/(console)/manage/suites/suites-view";

const VISIT_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const NOTE = "block text-micro font-normal text-text-secondary";

export interface BookingVisitSectionProps {
  booking: BookingDetail;
  createdByName: string | null;
  className?: string;
}

function moment(instant: string | null, note: string | null): ReactNode {
  if (instant === null && note === null) return null;
  return (
    <>
      {instant !== null && <span className="block">{formatDubaiDateTime(instant)}</span>}
      {note !== null && <span className={NOTE}>{note}</span>}
    </>
  );
}

function bookedBy(booking: BookingDetail, createdByName: string | null): string {
  if (createdByName) return `${sourceLabel(booking.source)} · by ${createdByName}`;
  return booking.source === "online" ? "Online by the guest" : sourceLabel(booking.source);
}

export function BookingVisitSection({ booking, createdByName, className }: BookingVisitSectionProps) {
  const childAges = childAgesLabel(
    booking.guests.filter((guest) => guest.kind === "child").map((guest) => guest.age),
  );

  return (
    <DetailSection title="Visit" Icon={CalendarDaysIcon} className={className}>
      <div className="flex flex-col gap-5">
        <DetailFieldGrid columns={4}>
          <DetailField label="Date" span={2} value={VISIT_DAY.format(new Date(booking.startsAt))} />
          <DetailField
            label="Time"
            value={
              <>
                <span className="block font-data tabular-nums">
                  {formatDubaiTime(booking.startsAt)} – {formatDubaiTime(booking.endsAt)}
                </span>
                <span className={NOTE}>{durationLabel(visitMinutes(booking.startsAt, booking.endsAt))}</span>
              </>
            }
          />
          <DetailField
            label="Suite"
            value={
              booking.suiteId === null ? null : (
                <Link
                  href={suitePath(booking.suiteId)}
                  className="rounded-(--radius-inner) font-data tabular-nums text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {suiteLabel(booking.suiteNumber)}
                </Link>
              )
            }
            emptyLabel="No suite secured"
          />
        </DetailFieldGrid>

        <Separator />

        <DetailFieldGrid columns={4}>
          <DetailField
            label="Guests"
            value={
              <>
                <span className="block">{guestsLabel(booking.adults, booking.children)}</span>
                {childAges !== null && <span className={NOTE}>{childAges}</span>}
              </>
            }
          />
          <DetailField
            label="Add-ons"
            value={
              booking.addons.length === 0 ? null : (
                <ul className="flex flex-col gap-1">
                  {booking.addons.map((addon, index) => (
                    <li key={`${addon.name}-${index}`}>
                      {addon.name}
                      <span className="font-data tabular-nums text-text-secondary"> × {addon.quantity}</span>
                    </li>
                  ))}
                </ul>
              )
            }
            emptyLabel="No add-ons"
          />
          <DetailField label="Cleaning after" value={`${booking.cleaningBufferMinutes} min`} data />
          <DetailField
            label="Booked"
            value={booking.createdAt === "" ? null : moment(booking.createdAt, bookedBy(booking, createdByName))}
          />
        </DetailFieldGrid>

        <Separator />

        <DetailFieldGrid columns={4}>
          <DetailField
            label="Arrived"
            value={moment(
              booking.arrivedAt,
              booking.lateArrivalMinutes === null ? null : `${booking.lateArrivalMinutes} min late`,
            )}
            emptyLabel="Not recorded"
          />
          <DetailField label="Checked in" value={moment(booking.checkedInAt, null)} emptyLabel="Not checked in" />
          <DetailField
            label="Checked out"
            value={moment(
              booking.checkedOutAt,
              booking.overrunMinutes === null ? null : `${booking.overrunMinutes} min overstay`,
            )}
            emptyLabel="Not checked out"
          />
        </DetailFieldGrid>
      </div>
    </DetailSection>
  );
}
