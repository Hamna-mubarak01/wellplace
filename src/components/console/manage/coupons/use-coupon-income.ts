"use client";

import { useEffect, useState } from "react";

import { previewCoupon } from "@/app/(console)/manage/coupons/actions";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import type { CouponPreviewRequest } from "@/lib/config/coupons";

export type CouponIncomeResult = Awaited<ReturnType<typeof previewCoupon>>;

export type CouponIncomeState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly result: CouponIncomeResult };

const PREVIEW_UNREACHABLE =
  "The expected income could not be calculated. Check your connection and try again.";

interface ResolvedIncome {
  readonly key: string;
  readonly result: CouponIncomeResult;
}

export function useCouponIncome(request: CouponPreviewRequest | null): {
  readonly state: CouponIncomeState;
  readonly retry: () => void;
} {
  const payload = request === null ? "" : JSON.stringify(request);
  const [attempt, setAttempt] = useState(0);
  const [resolved, setResolved] = useState<ResolvedIncome | null>(null);
  const key = payload === "" ? "" : `${attempt}:${payload}`;

  useEffect(() => {
    if (payload === "") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const body: unknown = JSON.parse(payload);
      previewCoupon(body)
        .then((result) => {
          if (!cancelled) setResolved({ key, result });
        })
        .catch((cause: unknown) => {
          console.error("[coupons] income preview did not respond", cause);
          if (!cancelled) setResolved({ key, result: { ok: false, message: PREVIEW_UNREACHABLE } });
        });
    }, CONSOLE_LIST.searchDelayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [payload, key]);

  const retry = () => setAttempt((current) => current + 1);

  if (payload === "") return { state: { status: "idle" }, retry };
  if (resolved === null || resolved.key !== key) return { state: { status: "loading" }, retry };
  return { state: { status: "ready", result: resolved.result }, retry };
}
