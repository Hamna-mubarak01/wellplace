"use client";

import { createContext, useContext } from "react";

import type { CouponRow } from "@/lib/config/coupons";

export interface CouponEditorValue {
  readonly create: () => void;
  readonly edit: (row: CouponRow) => void;
}

export const CouponEditorContext = createContext<CouponEditorValue | null>(null);

export function useCouponEditor(): CouponEditorValue {
  const value = useContext(CouponEditorContext);
  if (value === null) {
    throw new Error("useCouponEditor is only available inside CouponsWorkspace.");
  }
  return value;
}
