"use client";

import { CircleCheckIcon, CopyIcon, DownloadIcon } from "lucide-react";

import { couponDay } from "@/app/(console)/manage/coupons/coupons-view";
import { toast } from "@/lib/console/feedback";
import { todayInDubai } from "@/lib/domain/time";
import {
  couponDiscountText,
  couponsCsv,
  couponsCsvFilename,
  type CreatedCouponBatch,
} from "@/components/console/manage/coupons/coupon-create-model";
import type { CouponAddonChoices } from "@/components/console/manage/coupons/coupon-terms-model";
import { Button } from "@/components/shared/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CreatedCouponsViewProps {
  batch: CreatedCouponBatch;
  addons: CouponAddonChoices;
  onDone: () => void;
}

function batchSummary(batch: CreatedCouponBatch, addons: CouponAddonChoices): string {
  return [
    `Discount: ${couponDiscountText(batch.template, addons)}`,
    batch.template.validTo === null ? "No expiry" : `Expires ${couponDay(batch.template.validTo)}`,
    batch.batchName === null ? null : `Batch: ${batch.batchName}`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

export function CreatedCouponsView({ batch, addons, onDone }: CreatedCouponsViewProps) {
  const count = batch.codes.length;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(batch.codes.join("\n"));
      toast.success(count === 1 ? "Code copied" : `${count.toLocaleString("en-AE")} codes copied`);
    } catch (cause) {
      console.error("[coupons] clipboard copy failed", cause);
      toast.error("The codes could not be copied. Download the CSV instead.");
    }
  };

  const download = () => {
    try {
      const name = couponsCsvFilename(todayInDubai(), batch.batchName);
      const url = URL.createObjectURL(new Blob([couponsCsv(batch, addons)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      requestAnimationFrame(() => URL.revokeObjectURL(url));
      toast.success("CSV downloaded", { description: name });
    } catch (cause) {
      console.error("[coupons] csv download failed", cause);
      toast.error("The CSV could not be downloaded. Copy the codes instead.");
    }
  };

  return (
    <>
      <DialogHeader className="shrink-0 border-b border-border p-5 pr-12 text-left">
        <DialogTitle className="flex items-center gap-2">
          <CircleCheckIcon aria-hidden="true" className="size-5 shrink-0 text-success" />
          {count === 1 ? "Coupon created" : `${count.toLocaleString("en-AE")} coupons created`}
        </DialogTitle>
        <DialogDescription className="text-console-body text-pretty text-text-secondary">
          {batchSummary(batch, addons)}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
        <ol aria-label="Created codes" className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {batch.codes.map((code) => (
            <li
              key={code}
              className="border-b border-border py-2 font-data text-console-body break-all text-text-primary tabular-nums"
            >
              {code}
            </li>
          ))}
        </ol>
      </div>

      <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border bg-surface-raised p-4">
        <Button type="button" variant="outline" onClick={() => void copyAll()}>
          <CopyIcon aria-hidden="true" className="size-4" />
          Copy all
        </Button>
        <Button type="button" variant="outline" onClick={download}>
          <DownloadIcon aria-hidden="true" className="size-4" />
          Download CSV
        </Button>
        <Button type="button" autoFocus onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
