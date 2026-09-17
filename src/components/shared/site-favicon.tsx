"use client";

import { useEffect } from "react";

import { safeImageSrc } from "@/lib/config/cms/links";
import { SITE_ICON } from "@/lib/config/site-icon";

export function SiteFavicon() {
  useEffect(() => {
    let mounted = true;
    let request: AbortController | undefined;
    const channel = typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(SITE_ICON.publishedEvent);

    async function refresh() {
      request?.abort();
      const current = new AbortController();
      request = current;
      try {
        const response = await fetch(SITE_ICON.endpoint, { cache: "no-store", signal: current.signal });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (current.signal.aborted || !data || typeof data !== "object" || !("url" in data) || typeof data.url !== "string") return;
        const next = safeImageSrc(data.url, "");
        const icon = document.getElementById(SITE_ICON.linkId);
        if (next && icon instanceof HTMLLinkElement && icon.getAttribute("href") !== next) icon.href = next;
      } catch {
        return;
      }
    }

    function onPublished() {
      void refresh();
      channel?.postMessage(SITE_ICON.publishedEvent);
    }

    queueMicrotask(() => {
      if (mounted) void refresh();
    });
    if (channel) channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === SITE_ICON.publishedEvent) void refresh();
    };
    window.addEventListener(SITE_ICON.publishedEvent, onPublished);
    return () => {
      mounted = false;
      request?.abort();
      channel?.close();
      window.removeEventListener(SITE_ICON.publishedEvent, onPublished);
    };
  }, []);

  return <link id={SITE_ICON.linkId} rel="icon" href={SITE_ICON.fallback} />;
}
