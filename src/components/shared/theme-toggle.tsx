"use client";

import type { CSSProperties } from "react";
import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";

export type ThemeChoice = "light" | "dark" | "system";
type ExplicitTheme = Exclude<ThemeChoice, "system">;

const THEME_STORAGE_KEY = "wellplace-theme";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

const DARK_TRACK_STYLE = {
  "--marketing-button-base": "var(--theme-switch-dark-track)",
  "--marketing-button-border": "var(--theme-switch-border)",
  "--marketing-button-fill": "var(--theme-switch-border)",
  "--marketing-button-ink": "var(--theme-switch-thumb)",
  "--marketing-button-hover-ink": "var(--theme-switch-thumb)",
  "--theme-switch-symbol-current": "var(--theme-switch-dark-symbol)",
} as CSSProperties;

const LIGHT_TRACK_STYLE = {
  "--marketing-button-base": "var(--theme-switch-light-track)",
  "--marketing-button-border": "var(--theme-switch-border)",
  "--marketing-button-fill": "var(--theme-switch-border)",
  "--marketing-button-ink": "var(--theme-switch-light-symbol)",
  "--marketing-button-hover-ink": "var(--theme-switch-light-symbol)",
  "--theme-switch-symbol-current": "var(--theme-switch-light-symbol)",
} as CSSProperties;

const NAVIGATION_SIZE_STYLE = {
  "--measure-theme-switch-w": "var(--measure-theme-switch-nav-w)",
  "--measure-theme-switch-thumb": "var(--measure-theme-switch-nav-thumb)",
  "--measure-theme-switch-travel": "var(--measure-theme-switch-nav-travel)",
  "--space-theme-switch-inset": "var(--space-theme-switch-nav-inset)",
  height: "var(--measure-theme-switch-nav-h)",
} as CSSProperties;

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

function subscribeToSystemTheme(listener: () => void) {
  const query = window.matchMedia(SYSTEM_DARK_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
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

function persistTheme(choice: ExplicitTheme): boolean {
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

function readSystemTheme(): ExplicitTheme {
  return window.matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light";
}

function getServerSystemTheme(): ExplicitTheme {
  return "light";
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function applyTheme(choice: ExplicitTheme) {
  const root = document.documentElement;

  const commit = () => {
    root.setAttribute("data-theme", choice);
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

export interface ThemeToggleProps {
  className?: string;
  onScrim?: boolean;
  size?: "default" | "navigation";
}

export function ThemeToggle({
  className,
  onScrim = false,
  size = "default",
}: ThemeToggleProps) {
  const resolved = useSyncExternalStore(subscribeNever, getIsClient, getIsServer);
  const selectedTheme = useSyncExternalStore(
    subscribeToThemeChanges,
    readStoredTheme,
    getServerTheme,
  );
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    readSystemTheme,
    getServerSystemTheme,
  );
  const effectiveTheme = selectedTheme === "system" ? systemTheme : selectedTheme;
  const isDark = effectiveTheme === "dark";
  const nextTheme: ExplicitTheme = isDark ? "light" : "dark";

  return (
    <Button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark theme"
      title={`Switch to ${nextTheme} theme`}
      data-loading={!resolved || undefined}
      data-theme-source={selectedTheme}
      data-theme-state={effectiveTheme}
      variant="ghost"
      size="theme"
      onClick={() => applyTheme(nextTheme)}
      style={{
        ...(isDark ? DARK_TRACK_STYLE : LIGHT_TRACK_STYLE),
        ...(size === "navigation" ? NAVIGATION_SIZE_STYLE : null),
      }}
      className={cn(
        "theme-switch relative flex-none rounded-full border shadow-(--shadow-md) transition-[opacity,box-shadow] duration-300 hover:shadow-(--shadow-lg) data-loading:pointer-events-none data-loading:opacity-0 motion-reduce:transition-none",
        onScrim && "backdrop-blur-sm",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 left-(--space-theme-switch-inset) z-10 grid size-(--measure-theme-switch-thumb) -translate-y-1/2 place-items-center rounded-full bg-(--theme-switch-thumb) text-(--theme-switch-symbol-current) shadow-(--shadow-md) transition-transform duration-500 ease-out motion-reduce:transition-none",
          isDark
            ? "translate-x-0"
            : "translate-x-(--measure-theme-switch-travel)",
        )}
      >
        {isDark ? (
          <MoonIcon
            className={cn(
              "fill-current",
              size === "navigation" ? "size-(--measure-theme-switch-nav-icon)" : "size-7",
            )}
            strokeWidth={1.75}
          />
        ) : (
          <SunIcon
            className={cn(
              "fill-current",
              size === "navigation" ? "size-(--measure-theme-switch-nav-icon)" : "size-7",
            )}
            strokeWidth={2.25}
          />
        )}
      </span>
    </Button>
  );
}
