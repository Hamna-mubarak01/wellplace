"use client";

import { useSyncExternalStore } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ThemeChoice = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "wellplace-theme";

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemeChoice;
  label: string;
  Icon: typeof SunIcon;
}> = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

const ON_SCRIM_SHADOW = {
  textShadow: "0 1px 10px rgb(var(--scrim-rgb) / 0.5)",
} as const;

let listeners: ReadonlyArray<() => void> = [];

function notify() {
  for (const listener of listeners) listener();
}

function subscribeToThemeChanges(listener: () => void) {
  listeners = [...listeners, listener];
  window.addEventListener("storage", listener);
  return () => {
    listeners = listeners.filter((registered) => registered !== listener);
    window.removeEventListener("storage", listener);
  };
}

function readStoredTheme(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return "system";
  } catch {
    return "system";
  }
}

function persistTheme(choice: ThemeChoice): boolean {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    return true;
  } catch {
    return false;
  }
}

function getServerTheme(): ThemeChoice {
  return "system";
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;

  const commit = () => {
    if (choice === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", choice);
    }
    persistTheme(choice);
    notify();
  };

  const startViewTransition = document.startViewTransition?.bind(document);
  if (!startViewTransition || prefersReducedMotion()) {
    commit();
    return;
  }

  startViewTransition(commit);
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

export interface ThemeChoiceButtonsProps {
  className?: string;
  onScrim?: boolean;
}

export function ThemeChoiceButtons({ className, onScrim = false }: ThemeChoiceButtonsProps) {
  const resolved = useSyncExternalStore(subscribeNever, getIsClient, getIsServer);
  const theme = useSyncExternalStore(
    subscribeToThemeChanges,
    readStoredTheme,
    getServerTheme,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      data-loading={!resolved || undefined}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {THEME_OPTIONS.map(({ value, label, Icon }) => {
        const active = resolved && theme === value;
        return (
          <Button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            variant={active ? "default" : "ghost"}
            size="icon"
            onClick={() => applyTheme(value)}
            style={onScrim && !active ? ON_SCRIM_SHADOW : undefined}
            className={cn(
              "h-tap w-11 flex-1",
              !active &&
                (onScrim
                  ? "text-on-scrim-muted hover:bg-transparent hover:text-on-scrim"
                  : "text-text-secondary hover:bg-transparent hover:text-text-primary"),
            )}
          >
            <Icon aria-hidden="true" />
          </Button>
        );
      })}
    </div>
  );
}
