"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "wellplace-console-nav-groups";
const CHANGE_EVENT = "wellplace-console-nav-groups-change";

let latestValue: string | null = null;

function subscribe(onChange: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    latestValue = event.newValue;
    onChange();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readSnapshot(): string | null {
  if (latestValue !== null) return latestValue;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function readServerSnapshot(): string | null {
  return null;
}

function persist(value: string): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

function parse(raw: string | null): Readonly<Record<string, boolean>> {
  if (raw === null) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
    );
  } catch {
    return {};
  }
}

export interface NavGroupMemory {
  readonly remembered: Readonly<Record<string, boolean>>;
  readonly remember: (groupId: string, open: boolean) => void;
}

export function useNavGroupMemory(): NavGroupMemory {
  const raw = useSyncExternalStore(subscribe, readSnapshot, readServerSnapshot);
  const remembered = useMemo(() => parse(raw), [raw]);

  const remember = useCallback((groupId: string, open: boolean) => {
    const next = JSON.stringify({ ...parse(readSnapshot()), [groupId]: open });
    latestValue = next;
    persist(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { remembered, remember };
}
