"use client";

import { useEffect } from "react";

import { useCelebrationConfetti } from "@/components/marketing/celebration-confetti";
import { RECEIPT_LINK } from "@/lib/config/receipt";

export function ReceiptCelebration() {
  useCelebrationConfetti();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(RECEIPT_LINK.celebrateParam)) return;
    url.searchParams.delete(RECEIPT_LINK.celebrateParam);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  return null;
}
