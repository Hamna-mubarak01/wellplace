import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HistoryIcon, LockIcon, SlidersHorizontalIcon } from "lucide-react";

import { NewBookingAction } from "@/components/console/reception/new-booking-action";
import { BookingHistory } from "@/components/console/reception/booking-history";
import { readBookingAudit } from "@/lib/db/queries/booking-activity";
import { idSchema } from "@/lib/validation/console-inputs";
import { hasPermission, requireReception } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { findBooking } from "@/lib/db/queries/bookings";
import { loadSettingsSnapshot } from "@/lib/db/queries/settings";
import { getSetting, requireSetting } from "@/lib/config";
import { listPriceTiers } from "@/lib/db/queries/pricing";
import { continuationHourOf, overrunRatePerIncrementFils } from "@/lib/domain/overrun";
import { allowedActions, type BookingAction } from "@/lib/domain/booking";
import { listBookingPayments } from "@/lib/db/queries/payments";
import { Button } from "@/components/shared/button";
import { ConsolePage } from "@/components/console/console-page";
import { ConsoleCard, ConsoleCardBody, ConsoleSection } from "@/components/console/console-surface";
import { BookingActions } from "@/components/console/reception/booking-actions";
import { OverrunDialog } from "@/components/console/reception/overrun-dialog";
import { BookingBufferButton } from "@/components/console/reception/booking-buffer-button";
import { RescheduleDialog } from "@/components/console/reception/reschedule-dialog";
import { StayControls } from "@/components/console/reception/stay-controls";
import { BookingNotesForm } from "@/components/console/reception/booking-notes-form";
import { BookingStatusBadge } from "@/components/console/reception/booking-status-badge";
import { sourceLabel } from "@/components/console/reception/booking-format";
import {
  AcceptanceCard,
  BookingAlerts,
  BookingSummary,
  GuestCard,
  PaymentCard,
  StayCard,
  paymentPicture,
} from "@/components/console/reception/booking-detail";
import { ConsoleReadError } from "@/components/shared/console-read-error";

const CONTROLLED_ACTIONS: ReadonlySet<BookingAction> = new Set([
  "record_arrival",
  "check_in",
  "check_out",
  "mark_no_show",
  "cancel",
  "extend",
  "reschedule",
  "record_overrun",
]);

export const metadata: Metadata = {
  title: "Booking",
  robots: { index: false, follow: false },
};

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireReception();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [lookup, snapshot, payments, history, tiers] = await Promise.all([
    findBooking(supabase, id),
    loadSettingsSnapshot(supabase),
    listBookingPayments(supabase, id, true),
    readBookingAudit(supabase, id),
    listPriceTiers(supabase),
  ]);

  if (lookup.outcome === "not_found") notFound();

  if (lookup.outcome === "failed") {
    return (
      <ConsolePage title="Booking" backHref="/reception/bookings" backLabel="All bookings">
        <ConsoleReadError
          title="The booking could not be loaded"
          message={lookup.message}
          meaning="This is not the same as the booking not existing."
          remedy="Try again, and tell Management if it keeps happening."
        >
          <Link
            href="/reception/bookings"
            className="inline-flex min-h-tap items-center text-console-body text-danger-ink underline underline-offset-4"
          >
            Back to all bookings
          </Link>
        </ConsoleReadError>
      </ConsolePage>
    );
  }

  const booking = lookup.booking;
  const canChangePrice = hasPermission(session, "manual_price_change");
  const canCorrectCustomer = hasPermission(session, "correct_customer_record");
  const picture = payments.ok ? paymentPicture(payments.payments) : null;

  const overrunRateFor = (guestKind: "adult" | "child") =>
    tiers.ok
      ? overrunRatePerIncrementFils({
          tiers: tiers.tiers,
          guestKind,
          continuationHour: continuationHourOf(
            (new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) / 60_000,
          ),
          rateSource: requireSetting(snapshot, "overrun.rate_source"),
          incrementMinutes: requireSetting(snapshot, "overrun.increment_minutes"),
          fixedFilsPerIncrement: getSetting(snapshot, "overrun.fixed_fils_per_increment"),
          roundingFils: requireSetting(snapshot, "pricing.rounding_fils"),
        })
      : null;

  const open = allowedActions(booking.status).some((action) => CONTROLLED_ACTIONS.has(action));

  return (
    <ConsolePage
      title={booking.guestName || "Booking details"}
      backHref="/reception/bookings"
      backLabel="All bookings"
      status={<BookingStatusBadge status={booking.displayStatus ?? booking.status} />}
      meta={[
        <span key="reference" className="font-data tabular-nums">{booking.reference}</span>,
        `Booked ${sourceLabel(booking.source).toLowerCase()}`,
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button hoverEffect="sweep" asChild variant="outline">
            <Link href="/reception">Front desk</Link>
          </Button>
          <Suspense fallback={<Button disabled>Book again</Button>}>
            <NewBookingAction customerId={booking.customerId} />
          </Suspense>
        </div>
      }
    >
      <BookingAlerts booking={booking} />

      <BookingSummary booking={booking} payments={picture} />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <ConsoleCard>
            <ConsoleCardBody className="flex flex-col gap-3">
              <h2 className="flex min-h-tap items-center gap-2 text-console-body font-medium text-text-primary">
                {open ? (
                  <SlidersHorizontalIcon aria-hidden="true" className="size-4 text-text-muted" />
                ) : (
                  <LockIcon aria-hidden="true" className="size-4 text-text-muted" />
                )}
                {open ? "Change this booking" : "This visit is closed"}
              </h2>
              {open ? (
                <>
                  <p className="text-micro text-text-secondary">
                    Every change is checked against the other bookings before it is saved.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <BookingActions
                      booking={booking}
                      defaultExtensionMinutes={requireSetting(snapshot, "reception.default_extension_minutes")}
                    />
                    <RescheduleDialog
                      booking={booking}
                      maxHorizonDays={requireSetting(snapshot, "booking.max_horizon_days")}
                      durationsHours={requireSetting(snapshot, "booking.durations_hours")}
                    />
                    <OverrunDialog
                      booking={booking}
                      incrementMinutes={requireSetting(snapshot, "overrun.increment_minutes")}
                      canSeeMoney
                      adultRateFils={overrunRateFor("adult")}
                      childRateFils={overrunRateFor("child")}
                    />
                    <BookingBufferButton bookingId={booking.id} />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-micro text-text-muted">
                    The visit can no longer be changed. Its details, payment and history stay below.
                  </p>
                  {booking.status === "completed" && (
                    <div>
                      <BookingBufferButton bookingId={booking.id} />
                    </div>
                  )}
                </>
              )}
            </ConsoleCardBody>
          </ConsoleCard>

          <StayCard booking={booking}>{open && <StayControls booking={booking} />}</StayCard>

          <BookingNotesForm
            bookingId={booking.id}
            personalRequest={booking.personalRequest}
            internalNote={booking.internalNote}
          />

          <ConsoleSection title="Booking history" Icon={HistoryIcon}>
            {history.ok ? (
              <BookingHistory events={history.events} />
            ) : (
              <ConsoleReadError title="History unavailable" message={history.message} />
            )}
          </ConsoleSection>
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
          <GuestCard booking={booking} canCorrectCustomer={canCorrectCustomer} />
          <PaymentCard
            booking={booking}
            payments={picture}
            paymentsError={payments.ok ? null : payments.message}
            taxLabel={requireSetting(snapshot, "tax.label")}
            taxIsIncluded={requireSetting(snapshot, "tax.inclusive")}
            canChangePrice={canChangePrice}
          />
          <AcceptanceCard booking={booking} />
        </div>
      </div>
    </ConsolePage>
  );
}
