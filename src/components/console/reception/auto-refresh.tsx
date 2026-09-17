"use client";

import { useEffect, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CONSOLE_REFRESH_MILLISECONDS } from "@/lib/config/console-refresh";

export function ReceptionAutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  useEffect(() => {
    let requested = false;
    let resetRequested: number | undefined;
    const refresh = () => {
      if (process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).get("preview") === "1") return;
      if (pending || requested || document.visibilityState !== "visible" || !navigator.onLine) return;
      const editing = document.querySelector('[role="dialog"]:not([data-desk-inbox]), [data-reception-dragging="true"], [data-reception-navigating="true"], [data-console-navigating="true"], [role="listbox"], [role="menu"]') || document.activeElement?.matches("input, textarea, [contenteditable=true]");
      if (!editing) {
        requested = true;
        resetRequested = window.setTimeout(() => { requested = false; }, 0);
        start(() => router.refresh());
      }
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, CONSOLE_REFRESH_MILLISECONDS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(resetRequested);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pending, router, pathname]);
  return null;
}
