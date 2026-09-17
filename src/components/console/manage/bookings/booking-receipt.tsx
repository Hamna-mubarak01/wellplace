import type { ReactNode } from "react";

import { ConsoleCard } from "@/components/console/console-surface";
import { MoneyValue } from "@/components/console/shared/money-value";
import { Wordmark } from "@/components/shared/wordmark";
import { CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { BookingReceiptDocument } from "@/components/console/manage/bookings/receipt-model";
import { formatDubaiDateTime } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export interface BookingReceiptProps {
  receipt: BookingReceiptDocument;
}

function Line({ label, detail, children, strong = false }: { label: string; detail?: string | null; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2", strong && "border-t border-border-strong pt-3")}>
      <dt className={cn("min-w-0 text-console-body text-text-primary", strong && "font-semibold")}>
        {label}
        {detail && <span className="block text-micro font-normal text-text-secondary">{detail}</span>}
      </dt>
      <dd className={cn("shrink-0 text-right text-console-body text-text-primary", strong && "font-semibold")}>{children}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-console-label tracking-label text-text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

export function BookingReceipt({ receipt }: BookingReceiptProps) {
  return (
    <ConsoleCard data-receipt-document="" className="w-full max-w-3xl">
      <CardContent className="flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Wordmark variant="wordmark" height={24} label="WellPlace" />
            <h2 className="text-console-title font-medium text-text-primary">
              Receipt <span className="font-data tabular-nums">{receipt.reference}</span>
            </h2>
            <p className="text-console-body text-text-secondary">This is a receipt, not a tax invoice.</p>
          </div>
          <dl className="flex flex-col gap-1 text-right">
            <dt className="text-console-label tracking-label text-text-muted uppercase">Issued</dt>
            <dd className="text-console-body text-text-primary">{formatDubaiDateTime(receipt.issuedAt)}</dd>
            <dd className="text-micro text-text-secondary">Dubai time · {receipt.status}</dd>
          </dl>
        </div>

        {receipt.simulated && (
          <p className="rounded-(--radius-card) border border-info-border bg-info-wash px-4 py-3 text-console-body text-info-ink">
            Simulation. No money was charged for the payments on this receipt.
          </p>
        )}

        <Separator />

        <div className="grid gap-6 sm:grid-cols-2">
          <Block title="Guest">
            <p className="text-console-body font-medium text-text-primary">{receipt.guestName || "Name not recorded"}</p>
            {receipt.guestEmail && <p className="text-console-body break-all text-text-secondary">{receipt.guestEmail}</p>}
          </Block>
          <Block title="Visit">
            <p className="text-console-body font-medium text-text-primary">{receipt.visitDay}</p>
            <p className="font-data text-console-body tabular-nums text-text-secondary">
              {receipt.visitTime} · {receipt.length}
            </p>
            <p className="text-console-body text-text-secondary">
              {receipt.guests}
              {receipt.childAges !== null && ` · ${receipt.childAges.toLowerCase()}`}
            </p>
            {receipt.addons.length > 0 && (
              <p className="text-console-body text-text-secondary">{receipt.addons.join(", ")}</p>
            )}
          </Block>
        </div>

        <Block title="Price">
          {receipt.lines.length === 0 ? (
            <p className="text-console-body text-text-secondary">
              {receipt.isComplimentary ? "Complimentary visit." : "No price is stored for this booking."}
            </p>
          ) : (
            <dl className="divide-y divide-border">
              {receipt.lines.map((line) => (
                <Line key={line.key} label={line.label} detail={line.detail} strong={line.kind === "total"}>
                  {line.amountFils === null ? (
                    <span className="text-text-secondary">Included</span>
                  ) : (
                    <MoneyValue fils={line.amountFils} />
                  )}
                </Line>
              ))}
            </dl>
          )}
        </Block>

        <Block title="Payments">
          {receipt.payments.length === 0 ? (
            <p className="text-console-body text-text-secondary">No payment has been received.</p>
          ) : (
            <dl className="divide-y divide-border">
              {receipt.payments.map((payment) => (
                <Line
                  key={payment.key}
                  label={`${payment.method} · ${payment.status}`}
                  detail={[formatDubaiDateTime(payment.recordedAt), payment.reference, payment.simulated ? "Simulation, no money charged" : null]
                    .filter((part): part is string => Boolean(part))
                    .join(" · ")}
                >
                  <MoneyValue fils={payment.amountFils} />
                </Line>
              ))}
            </dl>
          )}
        </Block>

        {receipt.refunds.length > 0 && (
          <Block title="Refunds">
            <dl className="divide-y divide-border">
              {receipt.refunds.map((refund) => (
                <Line
                  key={refund.key}
                  label={refund.state}
                  detail={
                    refund.settledAt === null
                      ? `Requested ${formatDubaiDateTime(refund.requestedAt)}`
                      : `Returned ${formatDubaiDateTime(refund.settledAt)}`
                  }
                >
                  <MoneyValue fils={refund.amountFils} />
                </Line>
              ))}
            </dl>
          </Block>
        )}

        <Block title="Summary">
          <dl>
            <Line label="Paid">
              <MoneyValue fils={receipt.paidFils} />
            </Line>
            {receipt.refundedFils > 0 && (
              <Line label="Refunded">
                <MoneyValue fils={receipt.refundedFils} />
              </Line>
            )}
            {receipt.balanceFils !== null && (
              <Line label="Balance due" strong>
                <MoneyValue fils={receipt.balanceFils} />
              </Line>
            )}
          </dl>
        </Block>
      </CardContent>
    </ConsoleCard>
  );
}
