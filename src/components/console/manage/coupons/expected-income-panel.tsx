"use client";

import { useId } from "react";
import { RefreshCwIcon } from "lucide-react";

import type { CouponPreviewRequest } from "@/lib/config/coupons";
import { MoneyValue } from "@/components/console/shared/money-value";
import { listFormat } from "@/components/console/manage/coupons/coupon-create-model";
import {
  useCouponIncome,
  type CouponIncomeResult,
} from "@/components/console/manage/coupons/use-coupon-income";
import { Button } from "@/components/shared/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type IncomePreview = Extract<CouponIncomeResult, { ok: true }>["preview"];

export interface ExpectedIncomePanelProps {
  request: CouponPreviewRequest | null;
  className?: string;
}

function counted(count: number, one: string, other: string): string {
  return `${count.toLocaleString("en-AE")} ${count === 1 ? one : other}`;
}

function usedTimes(uses: number): string {
  return uses === 1 ? "once" : `${uses.toLocaleString("en-AE")} times`;
}

function IncomeFigures({ preview }: { preview: IncomePreview }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-console-body text-text-secondary">
          Smallest booking ({counted(preview.adults, "guest", "guests")},{" "}
          {counted(preview.durationHours, "hour", "hours")}):
        </p>
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-console-body">
          <span className="sr-only">Without the coupon</span>
          <MoneyValue fils={preview.withoutCoupon.totalFils} className="text-text-secondary" />
          <span aria-hidden="true" className="text-text-muted">
            →
          </span>
          <span className="sr-only">, with the coupon</span>
          <MoneyValue fils={preview.withCoupon.totalFils} className="font-semibold text-text-primary" />
        </p>
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-micro text-text-muted">
          <span>After VAT</span>
          <MoneyValue fils={preview.withoutCoupon.netFils} />
          <span aria-hidden="true">→</span>
          <span className="sr-only">, with the coupon</span>
          <MoneyValue fils={preview.withCoupon.netFils} />
        </p>
        <p className="text-console-body text-success">
          Guest saves <MoneyValue fils={preview.discountFils} className="font-medium" />
          {preview.freeAddonNames.length > 0 && `, with ${listFormat(preview.freeAddonNames)} free`}
        </p>
      </div>

      <Separator />

      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-console-body text-text-secondary">If used {usedTimes(preview.uses)}:</p>
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-console-body text-text-primary">
          <MoneyValue fils={preview.usesWithCouponFils} className="font-semibold" />
          <span>income</span>
        </p>
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-micro text-text-muted">
          <span>After VAT</span>
          <MoneyValue fils={preview.withCoupon.netFils * preview.uses} />
        </p>
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-console-body text-text-secondary">
          <MoneyValue fils={preview.usesDiscountFils} />
          <span>given away</span>
        </p>
      </div>

      <p className="text-micro text-text-muted">Totals include VAT.</p>
    </div>
  );
}

function IncomeSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <span className="sr-only">Calculating the expected income…</span>
      <div aria-hidden="true" className="flex min-w-0 flex-col gap-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Separator />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
      </div>
    </div>
  );
}

export function ExpectedIncomePanel({ request, className }: ExpectedIncomePanelProps) {
  const headingId = useId();
  const { state, retry } = useCouponIncome(request);

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-(--radius-card) border border-border bg-surface-sunken p-4",
        className,
      )}
    >
      <h3 id={headingId} className="text-console-label font-medium tracking-label text-text-muted uppercase">
        Expected income
      </h3>
      <div aria-live="polite" aria-busy={state.status === "loading"} className="min-w-0">
        {state.status === "idle" && (
          <p className="text-console-body text-text-secondary">Enter a discount to see the expected income.</p>
        )}
        {state.status === "loading" && <IncomeSkeleton />}
        {state.status === "ready" && state.result.ok && <IncomeFigures preview={state.result.preview} />}
        {state.status === "ready" && !state.result.ok && (
          <div className="flex min-w-0 flex-col items-start gap-3">
            <p className="text-console-body text-pretty text-text-secondary">{state.result.message}</p>
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              <RefreshCwIcon aria-hidden="true" className="size-4" />
              Try again
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
