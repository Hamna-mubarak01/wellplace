"use client";

import { CopyIcon, LinkIcon, PencilIcon, Share2Icon } from "lucide-react";

import type { CouponRow } from "@/lib/config/coupons";
import { toast } from "@/lib/console/feedback";
import { useCouponEditor } from "@/components/console/manage/coupons/coupon-editor-context";
import { ConsoleIconAction } from "@/components/console/shared/console-icon-action";

export interface CouponRowActionsProps {
  coupon: CouponRow;
}

export function CouponRowActions({ coupon }: CouponRowActionsProps) {
  const { edit } = useCouponEditor();

  const share = async (kind: "code" | "link" | "share") => {
    const url = new URL("/book", window.location.origin);
    url.searchParams.set("coupon", coupon.code);
    try {
      if (kind === "share" && navigator.share)
        await navigator.share({
          title: "WellPlace coupon",
          text: coupon.code,
          url: url.href,
        });
      else {
        await navigator.clipboard.writeText(
          kind === "code" ? coupon.code : url.href,
        );
        toast.success(kind === "code" ? "Code copied" : "Booking link copied");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        toast.error(
          "The coupon could not be copied. Select and copy the code from the table.",
        );
    }
  };

  return (
    <>
      <ConsoleIconAction label={`Edit ${coupon.code}`} Icon={PencilIcon} onClick={() => edit(coupon)} />
      <ConsoleIconAction
        label={`Copy ${coupon.code}`}
        Icon={CopyIcon}
        variant="ghost"
        onClick={() => void share("code")}
      />
      <ConsoleIconAction
        label={`Share ${coupon.code}`}
        Icon={Share2Icon}
        variant="ghost"
        onClick={() => void share("share")}
      />
      <ConsoleIconAction
        label={`Copy the booking link for ${coupon.code}`}
        Icon={LinkIcon}
        variant="ghost"
        onClick={() => void share("link")}
      />
    </>
  );
}
