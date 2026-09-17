import Link from "next/link";
import {
  CircleAlertIcon,
  InfoIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";

import type { AlertRow } from "@/lib/db/queries/operations";
import type { AlertKind, AlertSeverity } from "@/lib/domain/alerts";
import { formatDubaiDateTime, todayInDubai } from "@/lib/domain/time";
import { AlertResolveButton } from "@/components/console/reception/alert-resolve-button";
import { AlertRemediation } from "@/components/console/reception/alert-actions";
import { ConsoleEmpty } from "@/components/console/console-surface";

export const ALERT_LABEL: Readonly<Record<AlertKind, string>> = {
  hold_expiring: "Hold about to expire",
  payment_without_suite: "Paid, but no suite secured",
  payment_failed: "Payment failed",
  message_failed: "Message failed to send",
  arrival_overdue: "Arrival overdue",
  checkin_overdue: "Check-in overdue",
  cleaning_unconfirmed: "Cleaning not confirmed in time",
  upcoming_conflict: "Upcoming conflict",
  refund_pending: "Refund pending",
  manual_review_pending: "Manual review pending",
};

const ALERT_GUIDANCE: Readonly<Record<AlertKind, string>> = {
  hold_expiring: "A guest is close to losing their slot. Nothing to do unless they call — the hold releases itself when it runs out.",
  payment_without_suite:
    "A guest has paid but has no suite. Open the booking, arrange an available suite or another time, or start a refund. Contact the guest before closing this alert.",
  payment_failed:
    "The payment did not go through. Open the booking, take payment again, or cancel it.",
  message_failed:
    "The guest’s message did not send. Contact them by phone and record what you did when you resolve this alert.",
  arrival_overdue:
    "The guest is past their start time and has not arrived. Record their arrival when they get here, or mark the booking a no show.",
  checkin_overdue:
    "The guest arrived but has not been checked in. Check them in as they go through.",
  cleaning_unconfirmed:
    "The cleaning record is still open. Mark it finished when the work is done. If more time is needed, set the suite to Not ready with a reason. The buffer ends automatically.",
  upcoming_conflict:
    "A block, an overrun or maintenance overlaps a claim that has not started yet. Open the board and move one of them.",
  refund_pending:
    "A refund is waiting to be completed with the payment provider. Finish it there, then record what happened on the booking's payments.",
  manual_review_pending:
    "The payment is in manual review. Open the booking and decide before the guest arrives.",
};

const SEVERITY_ICON: Readonly<Record<AlertSeverity, LucideIcon>> = {
  critical: CircleAlertIcon,
  warning: TriangleAlertIcon,
  info: InfoIcon,
};

const SEVERITY_CLASS: Readonly<Record<AlertSeverity, string>> = {
  critical: "border-danger-border bg-danger-wash text-danger-ink",
  warning: "border-warning-border bg-warning-wash text-warning-ink",
  info: "border-info-border bg-info-wash text-info-ink",
};

const LINK_CLASS =
  "rounded-(--radius-control) underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none";

interface AlertDestination {
  readonly href: string;
  readonly label: string;
}

function destinationFor(alert: AlertRow): AlertDestination | null {
  if (alert.bookingId !== null) {
    return {
      href: `/reception/bookings/${alert.bookingId}`,
      label: "Open the booking",
    };
  }
  if (alert.entity === "public.bookings") {
    return {
      href: `/reception/bookings/${alert.entityId}`,
      label: "Open the booking",
    };
  }
  if (alert.entity === "public.cleaning_tasks") {
    return {
      href: `/reception?date=${todayInDubai(new Date(alert.openedAt))}#tasks`,
      label: "Open Front desk tasks",
    };
  }
  if (alert.entity === "public.suite_occupancy") {
    return { href: "/reception", label: "Open the suite board" };
  }
  return null;
}

export interface AlertListProps {
  alerts: readonly AlertRow[];
  emptyMessage?: string;
  resolvable?: boolean;
}

export function AlertList({
  alerts,
  emptyMessage,
  resolvable = false,
}: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <ConsoleEmpty
        Icon={ShieldCheckIcon}
        title="Nothing needs attention"
        description={
          emptyMessage ?? "Holds, payments, arrivals and cleaning are all on track."
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((alert) => {
        const Icon = SEVERITY_ICON[alert.severity];
        const destination = destinationFor(alert);
        const label = ALERT_LABEL[alert.kind];

        return (
          <li
            key={alert.id}
            className={`flex min-h-console-row flex-col justify-center rounded-(--radius-card) border px-4 py-3 ${SEVERITY_CLASS[alert.severity]}`}
          >
            <div className="flex items-start gap-3">
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-console-body font-medium">
                  {destination === null ? (
                    label
                  ) : (
                    <Link href={destination.href} className={LINK_CLASS}>
                      {label}
                    </Link>
                  )}
                </p>

                {resolvable && (
                  <p className="mt-1 max-w-prose text-console-body text-pretty">
                    {ALERT_GUIDANCE[alert.kind]}
                  </p>
                )}

                <p className="mt-0.5 font-data text-micro tabular-nums opacity-80">
                  Since {formatDubaiDateTime(alert.openedAt)}
                </p>
              </div>
            </div>

            {resolvable && (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                {destination !== null && (
                  <Link
                    href={destination.href}
                    className={`inline-flex min-h-tap items-center px-1 text-console-body underline ${LINK_CLASS}`}
                  >
                    {destination.label}
                  </Link>
                )}
                <AlertRemediation kind={alert.kind} entityId={alert.entityId} />
                <AlertResolveButton alertId={alert.id} label={label} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
