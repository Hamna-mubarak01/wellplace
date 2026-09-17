"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  COOKIE_CATEGORY_COPY,
  COOKIE_STORAGE_KEY,
  DEFAULT_COOKIE_CHOICE,
  consentStateFor,
  parseCookieChoice,
  serialiseCookieChoice,
  type CookieChoice,
  type OptionalCookieCategory,
  type StoredCookieChoice,
} from "@/lib/config/cookies";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const ALL_ACCEPTED: CookieChoice = {
  preferences: true,
  analytics: true,
  marketing: true,
};

const ALL_REJECTED: CookieChoice = {
  preferences: false,
  analytics: false,
  marketing: false,
};

interface CookieSnapshot {
  readonly choice: CookieChoice;
  readonly savedAt: string | null;
}

const DEFAULT_SNAPSHOT: CookieSnapshot = {
  choice: DEFAULT_COOKIE_CHOICE,
  savedAt: null,
};

let cachedRaw: string | null | undefined;
let cachedSnapshot: CookieSnapshot = DEFAULT_SNAPSHOT;

function readCookieSnapshot(): CookieSnapshot {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(COOKIE_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;

  const parsed = raw ? parseCookieChoice(raw) : null;
  if (!parsed || !raw) {
    cachedSnapshot = DEFAULT_SNAPSHOT;
    return cachedSnapshot;
  }

  let savedAt: string | null = null;
  try {
    const stored = JSON.parse(raw) as Partial<StoredCookieChoice>;
    if (typeof stored.at === "string") savedAt = stored.at;
  } catch {
    savedAt = null;
  }

  cachedSnapshot = { choice: parsed, savedAt };
  return cachedSnapshot;
}

function getServerSnapshot(): CookieSnapshot {
  return DEFAULT_SNAPSHOT;
}

let listeners: ReadonlyArray<() => void> = [];

function notify() {
  for (const listener of listeners) listener();
}

function subscribeToCookieChoiceChanges(listener: () => void) {
  listeners = [...listeners, listener];
  window.addEventListener("storage", listener);
  return () => {
    listeners = listeners.filter((registered) => registered !== listener);
    window.removeEventListener("storage", listener);
  };
}

function subscribeNever() {
  return () => {};
}
function getIsClient() {
  return true;
}
function getIsServer() {
  return false;
}

function formatSavedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-AE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dubai",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export interface CookieSettingsDialogProps {
  trigger: React.ReactNode;
}

export function CookieSettingsDialog({ trigger }: CookieSettingsDialogProps) {
  const idPrefix = useId();
  const [open, setOpen] = useState(false);

  const hydrated = useSyncExternalStore(subscribeNever, getIsClient, getIsServer);
  const persisted = useSyncExternalStore(
    subscribeToCookieChoiceChanges,
    readCookieSnapshot,
    getServerSnapshot,
  );

  const [draft, setDraft] = useState<CookieChoice | null>(null);
  const choice = draft ?? persisted.choice;

  function handleOpenChange(next: boolean) {
    if (next) setDraft(persisted.choice);
    setOpen(next);
  }

  function updateDraft(id: OptionalCookieCategory, next: boolean) {
    setDraft({ ...choice, [id]: next });
  }

  function commit(next: CookieChoice) {
    try {
      window.localStorage.setItem(COOKIE_STORAGE_KEY, serialiseCookieChoice(next));
    } catch (error) {
      console.error("Could not save cookie preferences", error);
      toast.error("Your preferences could not be saved", {
        description:
          "Check that this browser allows storage for WellPlace, then try again.",
      });
      return;
    }

    window.gtag?.("consent", "update", consentStateFor(next));

    notify();
    setDraft(null);
    setOpen(false);
    toast.success("Cookie preferences saved", {
      description: "Change these again at any time from Cookie Settings.",
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="gap-5 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-h3 text-text-primary">
            Cookie Settings
          </DialogTitle>
          <DialogDescription className="text-small text-text-secondary text-pretty">
            Choose which non-essential technologies WellPlace may use on
            future visits. Necessary technologies keep the website secure and
            cannot be switched off.
          </DialogDescription>
        </DialogHeader>

        {hydrated && persisted.savedAt ? (
          <p className="text-fine text-text-muted">
            Last saved {formatSavedAt(persisted.savedAt)}.
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          {hydrated
            ? COOKIE_CATEGORY_COPY.map((category) => {
                const optionalId = category.id as OptionalCookieCategory;
                const checked = category.locked ? true : choice[optionalId];
                const fieldId = `${idPrefix}-cookie-${category.id}`;

                return (
                  <div
                    key={category.id}
                    className="flex items-start justify-between gap-6 sm:items-center"
                  >
                    <div className="flex flex-col gap-0.5">
                      <Label
                        htmlFor={fieldId}
                        className="text-body font-medium text-text-primary"
                      >
                        {category.name}
                      </Label>
                      <p className="text-fine text-text-muted text-pretty">
                        {category.description}
                      </p>
                    </div>
                    <Switch
                      id={fieldId}
                      checked={checked}
                      disabled={category.locked}
                      onCheckedChange={
                        category.locked
                          ? undefined
                          : (next) => updateDraft(optionalId, next)
                      }
                    />
                  </div>
                );
              })
            : COOKIE_CATEGORY_COPY.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-6"
                >
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-9 rounded-full" />
                </div>
              ))}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => commit(ALL_REJECTED)}
            >
              Reject non-essential
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => commit(ALL_ACCEPTED)}
            >
              Accept all
            </Button>
          </div>
          <Button type="button" size="sm" onClick={() => commit(choice)}>
            Save preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
