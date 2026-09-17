import type { Metadata } from "next";

import { ThemeChoiceButtons } from "@/components/shared/theme-choice-buttons";
import { Wordmark } from "@/components/shared/wordmark";
import { HeroSlideshow } from "@/components/marketing/hero-slideshow";
import { JsonLd } from "@/components/marketing/structured-data";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import { SITE_NAME, breadcrumbJsonLd, pageMetadata } from "@/lib/config/seo";

const WAITLIST_TITLE = "Join the waitlist";
const WAITLIST_DESCRIPTION =
  "WellPlace is opening soon in Dubai. Join the waitlist for exclusive early access to fully private wellness suites.";

export const metadata: Metadata = pageMetadata({
  title: WAITLIST_TITLE,
  description: WAITLIST_DESCRIPTION,
  path: "/waitlist",
});

const NAV_TINT = {
  background:
    "linear-gradient(to bottom, color-mix(in srgb, var(--surface-base) 26%, transparent), transparent 72%)",
} as const;

const NAV_BLUR_LAYERS = [
  { blur: "blur(8px) saturate(1.05)", mask: "linear-gradient(to bottom, black 0%, transparent 28%)" },
  { blur: "blur(4px)", mask: "linear-gradient(to bottom, black 0%, black 18%, transparent 46%)" },
  { blur: "blur(2px)", mask: "linear-gradient(to bottom, transparent 14%, black 40%, transparent 66%)" },
  { blur: "blur(1px)", mask: "linear-gradient(to bottom, transparent 40%, black 66%, transparent 92%)" },
  { blur: "blur(0.5px)", mask: "linear-gradient(to bottom, transparent 62%, black 90%, transparent 100%)" },
] as const;

const WORDMARK_STYLE = {
  "--wordmark-h": "var(--measure-wordmark-h)",
  filter:
    "drop-shadow(0 1px 3px rgb(var(--scrim-rgb) / 0.45))" +
    " drop-shadow(0 2px 18px rgb(var(--scrim-rgb) / 0.65))",
} as React.CSSProperties;

const TOGGLE_SCRIM = {
  background: "rgb(var(--scrim-rgb) / 0.42)",
  backdropFilter: "blur(10px) saturate(1.05)",
  WebkitBackdropFilter: "blur(10px) saturate(1.05)",
} as const;

const HERO_SCRIM_MOBILE = {
  background:
    "radial-gradient(130% 90% at 30% 16%, rgb(var(--scrim-rgb)/0.24), rgb(var(--scrim-rgb)/0.62) 74%)," +
    "linear-gradient(180deg, rgb(var(--scrim-rgb)/0.44), rgb(var(--scrim-rgb)/0.24) 42%, rgb(var(--scrim-rgb)/0.6))",
} as const;

const HERO_SCRIM_DESKTOP = {
  background:
    "linear-gradient(180deg, rgb(var(--scrim-rgb)/0.16) 0%, rgb(var(--scrim-rgb)/0) 26%," +
    "rgb(var(--scrim-rgb)/0) 55%, rgb(var(--scrim-rgb)/0.52) 100%)",
} as const;

export default function WaitlistPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="wl-nav sticky top-0 z-50 flex items-start justify-between gap-4 overflow-visible">
                <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 -z-10 right-0 lg:right-1/2"
          style={NAV_TINT}
        >
          {NAV_BLUR_LAYERS.map((layer) => (
            <div
              key={layer.blur}
              className="absolute inset-0"
              style={{
                backdropFilter: layer.blur,
                WebkitBackdropFilter: layer.blur,
                maskImage: layer.mask,
                WebkitMaskImage: layer.mask,
              }}
            />
          ))}
        </div>
        <span className="mt-(--space-toggle-align) -mb-10 shrink-0" style={WORDMARK_STYLE}>
          <Wordmark variant="primary" height={96} label="WellPlace" preload />
        </span>
                <span className="mt-(--space-toggle-align) lg:hidden">
          <ThemeChoiceButtons onScrim />
        </span>
      </header>
      <main className="wl-shell flex flex-1 flex-col lg:grid lg:grid-cols-2">
        <div className="fixed top-0 right-0 bottom-0 left-0 z-0 overflow-hidden bg-surface-sunken lg:sticky lg:top-0 lg:right-auto lg:bottom-auto lg:left-auto lg:z-1 lg:h-screen lg:w-full">
          <div className="relative size-full">
            <HeroSlideshow label="The WellPlace interior, in warm timber and stone." />
            <div aria-hidden="true" style={HERO_SCRIM_MOBILE} className="absolute inset-0 lg:hidden" />
            <div aria-hidden="true" style={HERO_SCRIM_DESKTOP} className="absolute inset-0 hidden lg:block" />
          </div>
        </div>
        <div className="wl-panel relative z-10 grid min-w-0 flex-1 grid-cols-1 place-items-center lg:z-2">
          <div className="wl-card min-w-0 w-full max-w-card-floating motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500 motion-safe:ease-out lg:max-w-card-panel">
            <WaitlistForm
              minAge={requireSetting(EMPTY_SNAPSHOT, "booking.booker_min_age")}
              className="mt-(--space-heading-gap)"
              heading={
                <>
                  <h1 className="font-display text-headline font-medium tracking-headline text-text-primary text-pretty">
                    WellPlace is opening soon
                  </h1>
                  <p className="mt-2 max-w-lead text-lead text-text-secondary text-pretty lg:mt-3.5">
                    Behind one door, a wellness experience entirely your own.
                    Join the waitlist for exclusive early access.
                  </p>
                </>
              }
            />
          </div>
        </div>

        <span
          style={TOGGLE_SCRIM}
          className="fixed bottom-6 left-(--space-nav-inline) z-20 hidden rounded-(--radius-modal) p-1.5 lg:inline-flex"
        >
          <ThemeChoiceButtons onScrim />
        </span>
      </main>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: SITE_NAME, path: "/" },
          { name: WAITLIST_TITLE, path: "/waitlist" },
        ])}
      />
    </div>
  );
}
