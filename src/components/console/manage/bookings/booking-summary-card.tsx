import type { ReactNode } from "react";
import { ReceiptIcon } from "lucide-react";

import { DetailSection } from "@/components/console/shared/detail-section";
import { MoneyValue } from "@/components/console/shared/money-value";
import { EmptyValue } from "@/components/console/shared/empty-value";
import { StatusChip } from "@/components/console/shared/status-chip";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { formatAed } from "@/components/shared/money";
import { Separator } from "@/components/ui/separator";
import type { MoneySummary, PriceRow } from "@/components/console/manage/bookings/booking-model";
import { cn } from "@/lib/utils";

export interface BookingSummaryCardProps {
  rows: readonly PriceRow[];
  isComplimentary: boolean;
  money: MoneySummary | null;
  moneyError: string;
  paymentCount: number | null;
  statusLabel: string;
}

interface LineProps {
  label: string;
  detail?: string | null;
  strong?: boolean;
  quiet?: boolean;
  className?: string;
  children: ReactNode;
}

function Line({ label, detail, strong = false, quiet = false, className, children }: LineProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <dt className="min-w-0">
        <span className={cn("block", strong ? "font-semibold text-text-primary" : quiet ? "text-text-secondary" : "text-text-primary")}>
          {label}
        </span>
        {detail && <span className="block text-micro text-pretty text-text-secondary">{detail}</span>}
      </dt>
      <dd className={cn("shrink-0 text-right", strong ? "font-semibold text-text-primary" : quiet ? "text-text-secondary" : "text-text-primary")}>
        {children}
      </dd>
    </div>
  );
}

function paidDetail(paymentCount: number | null): string {
  if (paymentCount === null) return "Payments could not be listed";
  if (paymentCount === 0) return "No payments yet";
  return `${paymentCount} ${paymentCount === 1 ? "payment" : "payments"} recorded`;
}

function refundedDetail(money: MoneySummary): string | null {
  if (money.refundsPendingFils > 0) return `${formatAed(money.refundsPendingFils)} waiting to be returned`;
  return money.refundedFils > 0 ? "Returned to the guest" : null;
}

function balanceDetail(money: MoneySummary, statusLabel: string): string {
  switch (money.balance) {
    case "complimentary":
      return "Nothing to collect";
    case "closed":
      return `Booking is ${statusLabel.toLowerCase()}`;
    case "unpriced":
      return "No price stored yet";
    case "settled":
      return "Paid in full";
    case "due":
      return money.overrunFils > 0 ? "Includes the overstay charge" : "Still to be paid";
  }
}

export function BookingSummaryCard({
  rows,
  isComplimentary,
  money,
  moneyError,
  paymentCount,
  statusLabel,
}: BookingSummaryCardProps) {
  return (
    <DetailSection
      title="Payment"
      Icon={ReceiptIcon}
      actions={isComplimentary ? <StatusChip tone="brand">Complimentary</StatusChip> : undefined}
    >
      <div className="flex flex-col gap-4 text-console-body">
        {rows.length === 0 ? (
          <p className="text-pretty text-text-secondary">
            {isComplimentary
              ? "This booking is complimentary and is reported separately from revenue."
              : "No price is stored for this booking yet."}
          </p>
        ) : (
          <dl className="flex flex-col gap-3">
            {rows.map((row) => (
              <Line
                key={row.key}
                label={row.label}
                detail={row.detail}
                strong={row.kind === "total"}
                quiet={row.kind === "included" || row.kind === "overrun"}
                className={row.kind === "total" ? "border-t border-border pt-3" : undefined}
              >
                {row.amountFils === null ? "Included" : <MoneyValue fils={row.amountFils} />}
              </Line>
            ))}
          </dl>
        )}

        <Separator />

        {money === null ? (
          <ConsoleReadError
            title="The payment totals could not be loaded"
            message={moneyError}
            unaffected="The booking and its payment log are unaffected."
          />
        ) : (
          <dl className="flex flex-col gap-3">
            <Line label="Paid" detail={paidDetail(paymentCount)}>
              <MoneyValue fils={money.paidFils} />
            </Line>
            <Line label="Refunded" detail={refundedDetail(money)}>
              <MoneyValue fils={money.refundedFils} />
            </Line>
            <Line
              label="Balance due"
              detail={balanceDetail(money, statusLabel)}
              strong
              className="rounded-(--radius-inner) bg-surface-base px-3 py-3"
            >
              {money.balanceFils === null ? (
                <EmptyValue label="No balance applies" />
              ) : (
                <MoneyValue fils={money.balanceFils} className="text-console-title" />
              )}
            </Line>
          </dl>
        )}
      </div>
    </DetailSection>
  );
}
