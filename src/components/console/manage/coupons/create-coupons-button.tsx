"use client";

import { PlusIcon } from "lucide-react";

import { useCouponEditor } from "@/components/console/manage/coupons/coupon-editor-context";
import { Button } from "@/components/shared/button";

export interface CreateCouponsButtonProps {
  variant?: "default" | "outline";
}

export function CreateCouponsButton({ variant = "default" }: CreateCouponsButtonProps) {
  const { create } = useCouponEditor();

  return (
    <Button type="button" variant={variant} onClick={create}>
      <PlusIcon aria-hidden="true" className="size-4" />
      Create coupons
    </Button>
  );
}
