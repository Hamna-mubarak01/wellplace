import type { ReactNode } from "react";
import {
  CalendarClockIcon,
  CircleCheckIcon,
  DoorOpenIcon,
  FileCheckIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import type { BookingDetail } from "@/lib/db/queries/bookings";
import type { PaymentMethod, PaymentRow } from "@/lib/db/queries/payments";
import { formatDubaiDateTime, formatDubaiDayLong, formatDubaiTime } from "@/lib/domain/time";
import { guestSummary, sourceLabel } from "@/components/console/reception/booking-format";
import { formatAed } from "@/components/shared/money";
import { ConsoleCard, ConsoleCardBody } from "@/components/console/console-surface";
import { GuestWarningDialog } from "@/components/console/reception/guest-warning-dialog";
import { ManualPriceDialog } from "@/components/console/reception/manual-price-dialog";
import { RefundDialog } from "@/components/console/reception/refund-dialog";
import { WithdrawRefundDialog } from "@/components/console/reception/withdraw-refund-dialog";
import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { StatusChip } from "@/components/console/shared/status-chip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const METHOD_LABEL: Readonly<Record<PaymentMethod, string>> = {
  cash: "Cash",
  card_terminal: "Card",
  payment_link: "Payment link",
  online: "Online",
  complimentary: "Complimentary",
};

const SETTLED = new Set(["paid", "partially_refunded", "fully_refunded"]);

export interface PaymentPicture {
  readonly settled: readonly PaymentRow[];
  readonly paidFils: number;
  readonly refundedFils: number;
  readonly pendingRefundFils: number;
}

export function paymentPicture(payments: readonly PaymentRow[]): PaymentPicture {
  const settled = payments.filter((payment) => SETTLED.has(payment.status));
  const pendingRefundFils = settled.reduce(
    (sum, payment) => sum + (payment.pendingRefunds ?? []).reduce((inner, refund) => inner + refund.amountFils, 0),
    0,
  );
  return {
    settled,
    paidFils: settled.reduce((sum, payment) => sum + payment.amountFils, 0),
    refundedFils: settled.reduce(
      (sum, payment) => sum + Math.max(payment.amountFils - (payment.refundableFils ?? payment.amountFils), 0),
      0,
    ) - pendingRefundFils,
    pendingRefundFils,
  };
}

function CardTitle({ Icon, children, action }: { Icon: typeof UserRoundIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-tap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-console-body font-medium text-text-primary">
        <Icon aria-hidden="true" className="size-4 text-text-muted" />
        {children}
      </h2>
      {action}
    </div>
  );
}

function Row({ label, value, muted = false, data = false }: { label: string; value: ReactNode; muted?: boolean; data?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-console-body text-text-secondary">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-right text-console-body break-words",
          muted ? "text-text-muted" : "text-text-primary",
          data && "font-data tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function BookingAlerts({ booking }: { booking: BookingDetail }) {
  return (
    <>
      {(booking.isBlocked || booking.warningNote) && (
        <div className="flex items-start gap-3 rounded-(--radius-card) border border-danger-border bg-danger-wash px-4 py-3">
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 text-danger-ink" />
          <div className="min-w-0">
            <p className="text-console-body font-medium text-danger-ink">
              {booking.isBlocked ? "This guest is blocked" : "Guest warning"}
            </p>
            {booking.warningNote && <p className="mt-1 text-console-body text-danger-ink">{booking.warningNote}</p>}
          </div>
        </div>
      )}
      {booking.suiteNumber === null && booking.status !== "cancelled" && (
        <div className="rounded-(--radius-card) border border-danger-border bg-danger-wash px-4 py-3">
          <p className="text-console-body font-medium text-danger-ink">No suite is secured for this booking</p>
          <p className="mt-1 text-console-body text-danger-ink">
            A paying guest must never be left without a suite. Move the booking to a free suite, or refund and cancel it.
          </p>
        </div>
      )}
    </>
  );
}

export function BookingSummary({ booking, payments }: { booking: BookingDetail; payments: PaymentPicture | null }) {
  const paidLabel =
    payments === null
      ? "Payment not shown"
      : payments.refundedFils > 0
        ? `Refunded ${formatAed(payments.refundedFils)}`
        : payments.paidFils > 0
          ? `Paid in full · ${[...new Set(payments.settled.map((payment) => METHOD_LABEL[payment.method]))].join(", ")}`
          : "No payment on record";

  return (
    <StatGrid columns={4} label="Booking summary">
      <StatCard
        label="Visit"
        value={formatDubaiDayLong(booking.startsAt)}
        sub={`${formatDubaiTime(booking.startsAt)} – ${formatDubaiTime(booking.endsAt)} · Dubai time`}
        Icon={CalendarClockIcon}
      />
      <StatCard
        label="Suite"
        value={booking.suiteNumber === null ? "Not secured" : `Suite ${booking.suiteNumber}`}
        sub={`${booking.cleaningBufferMinutes} min cleaning after`}
        tone={booking.suiteNumber === null ? "danger" : "neutral"}
        Icon={DoorOpenIcon}
      />
      <StatCard
        label="Guests"
        value={guestSummary(booking.adults, booking.children)}
        sub={`Booked ${sourceLabel(booking.source).toLowerCase()} · ${formatDubaiDateTime(booking.createdAt)}`}
        Icon={UsersIcon}
      />
      <StatCard
        label="Total"
        value={booking.totalFils === null ? "Not priced" : formatAed(booking.totalFils)}
        sub={paidLabel}
        tone={payments !== null && payments.refundedFils > 0 ? "warning" : payments !== null && payments.paidFils > 0 ? "success" : "neutral"}
        Icon={WalletIcon}
      />
    </StatGrid>
  );
}

export function StayCard({ booking, children }: { booking: BookingDetail; children?: ReactNode }) {
  const stamp = (value: string | null) => (value ? formatDubaiDateTime(value) : "Not yet");
  return (
    <ConsoleCard>
      <ConsoleCardBody className="flex flex-col gap-3">
        <CardTitle Icon={CircleCheckIcon}>Arrival and departure</CardTitle>
        <dl className="divide-y divide-border">
          <Row label="Arrived" value={stamp(booking.arrivedAt)} muted={!booking.arrivedAt} data={Boolean(booking.arrivedAt)} />
          <Row label="Checked in" value={stamp(booking.checkedInAt)} muted={!booking.checkedInAt} data={Boolean(booking.checkedInAt)} />
          <Row label="Checked out" value={stamp(booking.checkedOutAt)} muted={!booking.checkedOutAt} data={Boolean(booking.checkedOutAt)} />
          {booking.lateArrivalMinutes !== null && <Row label="Late arrival" value={`${booking.lateArrivalMinutes} min`} data />}
          {booking.overrunMinutes !== null && <Row label="Stayed over" value={`${booking.overrunMinutes} min`} data />}
        </dl>
        {children}
      </ConsoleCardBody>
    </ConsoleCard>
  );
}

export function GuestCard({ booking, canCorrectCustomer }: { booking: BookingDetail; canCorrectCustomer: boolean }) {
  const childAges = booking.guests
    .filter((guest) => guest.kind === "child")
    .map((guest) => guest.age ?? "?")
    .join(", ");
  return (
    <ConsoleCard>
      <ConsoleCardBody className="flex flex-col gap-3">
        <CardTitle
          Icon={UserRoundIcon}
          action={
            canCorrectCustomer ? (
              <GuestWarningDialog
                bookingId={booking.id}
                customerId={booking.customerId}
                warningNote={booking.warningNote}
                isBlocked={booking.isBlocked}
              />
            ) : undefined
          }
        >
          Guest
        </CardTitle>
        <dl className="divide-y divide-border">
          <Row label="Name" value={booking.guestName || "Not provided"} muted={!booking.guestName} />
          <Row label="Email" value={booking.guestEmail || "Not provided"} muted={!booking.guestEmail} />
          <Row label="Mobile" value={booking.guestPhone || "Not provided"} muted={!booking.guestPhone} data={Boolean(booking.guestPhone)} />
          <Row label="Guests" value={guestSummary(booking.adults, booking.children)} />
          {booking.children > 0 && <Row label="Children's ages" value={childAges} data />}
        </dl>
      </ConsoleCardBody>
    </ConsoleCard>
  );
}

export function PaymentCard({
  booking,
  payments,
  paymentsError,
  taxLabel,
  taxIsIncluded,
  canChangePrice,
}: {
  booking: BookingDetail;
  payments: PaymentPicture | null;
  paymentsError: string | null;
  taxLabel: string;
  taxIsIncluded: boolean;
  canChangePrice: boolean;
}) {
  const discount = booking.discountFils ?? 0;
  const serviceFee = booking.serviceFeeFils ?? 0;
  const tax = booking.taxFils ?? 0;

  return (
    <ConsoleCard>
      <ConsoleCardBody className="flex flex-col gap-3">
        <CardTitle
          Icon={ReceiptTextIcon}
          action={
            canChangePrice ? <ManualPriceDialog bookingId={booking.id} currentTotalFils={booking.totalFils} /> : undefined
          }
        >
          Price and payment
        </CardTitle>

        {booking.totalFils === null ? (
          <p className="text-console-body text-text-muted">No price is stored for this booking.</p>
        ) : (
          <dl className="divide-y divide-border">
            <Row label="Visit" value={formatAed(booking.subtotalFils ?? 0)} data />
            {discount > 0 && <Row label="Discount" value={formatAed(-discount)} data />}
            {booking.addons.map((line) => (
              <Row
                key={line.name}
                label={`${line.name} × ${line.quantity}`}
                value={line.lineTotalFils === 0 ? "Included" : formatAed(line.lineTotalFils)}
                muted={line.lineTotalFils === 0}
                data={line.lineTotalFils !== 0}
              />
            ))}
            {serviceFee > 0 && <Row label="Service fee" value={formatAed(serviceFee)} data />}
            {tax > 0 && !taxIsIncluded && <Row label={taxLabel} value={formatAed(tax)} data />}
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-console-body font-medium text-text-primary">Total</dt>
              <dd className="text-right">
                <span className="block font-data text-console-title font-semibold tabular-nums text-text-primary">
                  {formatAed(booking.totalFils)}
                </span>
                {tax > 0 && taxIsIncluded && (
                  <span className="block font-data text-micro tabular-nums text-text-muted">
                    Includes {formatAed(tax)} {taxLabel}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        )}

        <Separator />

        {paymentsError !== null ? (
          <p className="text-console-body text-danger-ink">{paymentsError}</p>
        ) : payments === null || payments.settled.length === 0 ? (
          <p className="text-console-body text-text-muted">No payment on record for this booking.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {payments.settled.map((payment) => {
              const refundable = payment.refundableFils ?? 0;
              const refunded = payment.status === "fully_refunded" || payment.status === "partially_refunded";
              return (
                <li key={payment.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-data text-console-body tabular-nums text-text-primary">{formatAed(payment.amountFils)}</span>
                        <StatusChip tone={refunded ? "warning" : "success"}>
                          {payment.status === "fully_refunded" ? "Refunded" : payment.status === "partially_refunded" ? "Partly refunded" : "Paid"}
                        </StatusChip>
                      </p>
                      <p className="mt-1 text-micro text-text-secondary">
                        {METHOD_LABEL[payment.method]} · {formatDubaiDateTime(payment.recordedAt)}
                        {payment.recordedByName ? ` · ${payment.recordedByName}` : ""}
                      </p>
                    </div>
                    {refundable > 0 && (
                      <RefundDialog
                        bookingId={booking.id}
                        paymentId={payment.id}
                        paymentAmountFils={refundable}
                        paymentLabel={`${METHOD_LABEL[payment.method]} · ${formatAed(payment.amountFils)}`}
                      />
                    )}
                  </div>
                  {(payment.pendingRefunds ?? []).map((refund) => (
                    <div key={refund.id} className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-control) bg-warning-wash px-3 py-2 text-micro text-warning-ink">
                      <span className="font-data tabular-nums">
                        Refund of {formatAed(refund.amountFils)} waiting to be returned
                      </span>
                      {!refund.automatic && (
                        <WithdrawRefundDialog bookingId={booking.id} refundId={refund.id} amountFils={refund.amountFils} />
                      )}
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </ConsoleCardBody>
    </ConsoleCard>
  );
}

export function AcceptanceCard({ booking }: { booking: BookingDetail }) {
  if (booking.acceptance.length === 0) return null;
  return (
    <ConsoleCard>
      <ConsoleCardBody className="flex flex-col gap-2">
        <CardTitle Icon={FileCheckIcon}>Terms accepted</CardTitle>
        <p className="text-micro text-pretty text-text-secondary">{booking.acceptance[0].checkboxText}</p>
        <p className="font-data text-micro tabular-nums text-text-muted">{formatDubaiDateTime(booking.acceptance[0].acceptedAt)}</p>
      </ConsoleCardBody>
    </ConsoleCard>
  );
}
