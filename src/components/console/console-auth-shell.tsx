import Image from "next/image";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Wordmark } from "@/components/shared/wordmark";

const HERO_SCRIM_MOBILE = {
  background:
    "radial-gradient(130% 90% at 30% 16%, rgb(var(--scrim-rgb)/0.28), rgb(var(--scrim-rgb)/0.66) 74%)," +
    "linear-gradient(180deg, rgb(var(--scrim-rgb)/0.5), rgb(var(--scrim-rgb)/0.3) 42%, rgb(var(--scrim-rgb)/0.66))",
} as const;

const HERO_SCRIM_DESKTOP = {
  background:
    "linear-gradient(180deg, rgb(var(--scrim-rgb)/0.44) 0%, rgb(var(--scrim-rgb)/0.08) 34%," +
    "rgb(var(--scrim-rgb)/0.06) 62%, rgb(var(--scrim-rgb)/0.42) 100%)",
} as const;

const WORDMARK_STYLE = {
  "--wordmark-h": "var(--measure-wordmark-h)",
  filter:
    "drop-shadow(0 1px 3px rgb(var(--scrim-rgb) / 0.45))" +
    " drop-shadow(0 2px 18px rgb(var(--scrim-rgb) / 0.65))",
} as React.CSSProperties;

export interface ConsoleAuthShellProps {
  heroSrc: string;
  heroAlt: string;
  heroFocus?: string;
  children: React.ReactNode;
}

export function ConsoleAuthShell({
  heroSrc,
  heroAlt,
  heroFocus = "50% 50%",
  children,
}: ConsoleAuthShellProps) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col lg:grid lg:grid-cols-2">
      <div className="fixed inset-0 -z-10 overflow-hidden bg-surface-sunken lg:sticky lg:inset-auto lg:top-0 lg:z-0 lg:h-dvh lg:w-full">
        <div className="relative size-full">
          <Image
            src={heroSrc}
            alt={heroAlt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            preload
            className="object-cover"
            style={{ objectPosition: heroFocus }}
          />
          <div
            aria-hidden="true"
            style={HERO_SCRIM_MOBILE}
            className="absolute inset-0 lg:hidden"
          />
          <div
            aria-hidden="true"
            style={HERO_SCRIM_DESKTOP}
            className="absolute inset-0 hidden lg:block"
          />
        </div>
      </div>

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 px-4 pt-3 sm:px-8 lg:pt-5">
        <span className="shrink-0" style={WORDMARK_STYLE}>
          <Wordmark variant="primary" height={96} label="WellPlace" preload onScrim />
        </span>

        <ThemeToggle
          onScrim
          size="navigation"
          className="inline-flex shrink-0 lg:hidden"
        />

        <ThemeToggle
          size="navigation"
          className="hidden shrink-0 lg:inline-flex"
        />
      </header>

      <div className="relative z-10 flex flex-1 flex-col lg:bg-surface-base">
        <main className="flex flex-1 items-center justify-center px-4 pt-(--measure-wordmark-h) pb-6 sm:px-8 lg:pt-6">
          <div className="w-full max-w-auth-card rounded-(--radius-modal) border border-border bg-surface-raised p-6 shadow-(--shadow-md) sm:p-8 lg:shadow-none">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
