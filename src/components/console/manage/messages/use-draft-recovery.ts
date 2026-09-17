"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { MESSAGE_EDITOR } from "@/lib/config/message-documents";
import {
  messageDraftSignature,
  parseMessageRecovery,
} from "@/lib/validation/message-draft";
import type { TemplateDraft } from "./editor-history";

const subscribe = () => () => undefined;
const serverSnapshot = () => null;

export function useDraftRecovery({
  storageKey,
  current,
  baseline,
  savedAt,
}: {
  storageKey?: string;
  current: TemplateDraft;
  baseline: TemplateDraft;
  savedAt: string | null;
}) {
  const initial = useRef<{
    key: string | undefined;
    raw: string | null;
  } | null>(null);
  const [owner] = useState(() => crypto.randomUUID());
  const [openedBaseline] = useState(() => messageDraftSignature(baseline));
  const discarded = useRef<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const snapshot = useCallback(() => {
    if (initial.current && initial.current.key === storageKey)
      return initial.current.raw;
    let raw: string | null = null;
    try {
      if (storageKey) raw = window.localStorage.getItem(storageKey);
    } catch {}
    initial.current = { key: storageKey, raw };
    return raw;
  }, [storageKey]);
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const parsed = useMemo(() => parseMessageRecovery(raw), [raw]);
  const currentJson = messageDraftSignature(current);
  const baselineJson = messageDraftSignature(baseline);
  const candidate =
    !dismissed &&
    parsed &&
    messageDraftSignature(parsed.draft) !== openedBaseline
      ? parsed
      : null;

  useEffect(() => {
    if (!storageKey || candidate) return;
    const persist = () => {
      if (discarded.current === currentJson) return;
      try {
        if (currentJson !== baselineJson) {
          window.localStorage.setItem(
            storageKey,
            JSON.stringify({ owner, savedAt, draft: JSON.parse(currentJson) }),
          );
        } else {
          const stored = parseMessageRecovery(
            window.localStorage.getItem(storageKey),
          );
          if (
            stored?.owner === owner ||
            (stored && messageDraftSignature(stored.draft) === baselineJson)
          )
            window.localStorage.removeItem(storageKey);
        }
        setUnavailable(false);
      } catch {
        setUnavailable(true);
      }
    };
    const timer = window.setTimeout(persist, MESSAGE_EDITOR.recoveryDelayMs);
    window.addEventListener("pagehide", persist);
    window.addEventListener("beforeunload", persist);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", persist);
      window.removeEventListener("beforeunload", persist);
    };
  }, [storageKey, candidate, owner, currentJson, baselineJson, savedAt]);

  const discard = () => {
    discarded.current = currentJson;
    try {
      if (storageKey) window.localStorage.removeItem(storageKey);
    } catch {}
    setDismissed(true);
  };

  return { candidate, dismiss: () => setDismissed(true), discard, unavailable };
}
