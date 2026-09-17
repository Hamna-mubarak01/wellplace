import Link from "next/link";
import { TriangleAlertIcon, UserRoundIcon } from "lucide-react";

import { DetailSection } from "@/components/console/shared/detail-section";
import { DetailField } from "@/components/console/shared/detail-field";
import { ConsoleNotice } from "@/components/console/console-surface";
import { Button } from "@/components/shared/button";
import type { BookingDetail } from "@/lib/db/queries/bookings";
import { formatDubaiDateTime } from "@/lib/domain/time";

export interface BookingCustomerSectionProps {
  booking: BookingDetail;
}

const LINK_CLASS =
  "rounded-(--radius-inner) text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring";

export function BookingCustomerSection({ booking }: BookingCustomerSectionProps) {
  const customerHref = booking.customerId === "" ? null : `/manage/customers/${booking.customerId}`;
  const acceptance = booking.acceptance[0] ?? null;

  return (
    <DetailSection
      title="Customer"
      Icon={UserRoundIcon}
      className="h-full"
      actions={
        customerHref === null ? undefined : (
          <Button asChild variant="outline" size="sm">
            <Link href={customerHref}>View profile</Link>
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {(booking.isBlocked || booking.warningNote) && (
          <ConsoleNotice tone="warning" Icon={TriangleAlertIcon} role="note">
            <span className="block font-medium">
              {booking.isBlocked ? "This customer is blocked from booking" : "Customer warning"}
            </span>
            {booking.warningNote && <span className="mt-1 block text-pretty">{booking.warningNote}</span>}
          </ConsoleNotice>
        )}

        <dl className="flex flex-col gap-4">
          <DetailField label="Name" value={booking.guestName} emptyLabel="Name not recorded" />
          <DetailField
            label="Email"
            value={
              booking.guestEmail === "" ? null : (
                <a href={`mailto:${booking.guestEmail}`} className={`${LINK_CLASS} break-all`}>
                  {booking.guestEmail}
                </a>
              )
            }
            emptyLabel="Email not recorded"
          />
          <DetailField
            label="Mobile"
            data
            value={
              booking.guestPhone === "" ? null : (
                <a href={`tel:${booking.guestPhone}`} className={LINK_CLASS}>
                  {booking.guestPhone}
                </a>
              )
            }
            emptyLabel="Mobile not recorded"
          />
          <DetailField
            label="Terms accepted"
            value={
              acceptance === null ? null : (
                <>
                  <span className="block">{formatDubaiDateTime(acceptance.acceptedAt)}</span>
                  <span className="block text-micro font-normal text-pretty text-text-secondary">
                    {booking.acceptance.map((record) => `${record.documentSlug} v${record.documentVersion}`).join(", ")}
                  </span>
                </>
              )
            }
            emptyLabel="No acceptance recorded"
          />
        </dl>
      </div>
    </DetailSection>
  );
}
