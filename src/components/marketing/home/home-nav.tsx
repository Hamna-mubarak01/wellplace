"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Wordmark } from "@/components/shared/wordmark";
import { Button } from "@/components/shared/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MARKETING_NAV_MENU_STAGGER_MS } from "@/lib/config/marketing";
import type { ResolvedNavbar } from "@/lib/config/cms/site-chrome-content";
import { WAITLIST_CHROME, type SiteChromeVariant } from "@/lib/config/site-chrome";
import { cn } from "@/lib/utils";

export interface SiteNavProps {
  content: ResolvedNavbar;
  bookHref: string;
  overlayHeroId?: string;
  variant?: SiteChromeVariant;
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export function SiteNav({ content, bookHref, overlayHeroId, variant = "site" }: SiteNavProps) {
  const waitlist = variant === "waitlist";
  const links = waitlist ? [] : content.links;
  const actionHref = waitlist ? WAITLIST_CHROME.href : bookHref;
  const actionLabel = waitlist ? WAITLIST_CHROME.actionLabel : content.bookLabel;
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [solid, setSolid] = useState(!overlayHeroId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!overlayHeroId) return;

    let frame = 0;
    const sync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const hero = document.getElementById(overlayHeroId);
        const headerHeight = headerRef.current?.offsetHeight ?? 0;
        setSolid(hero ? hero.getBoundingClientRect().bottom <= headerHeight * 2 : true);
      });
    };

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync);
    };
  }, [overlayHeroId]);

  const overlaysHero = Boolean(overlayHeroId);
  const bookingActive = isActivePath(pathname, actionHref);

  return (
    <header
      ref={headerRef}
      data-solid={solid || undefined}
      className={cn(
        "group fixed inset-x-0 top-(--space-home-nav-top) z-50 flex h-nav items-center border-b border-transparent bg-transparent px-5 transition-[top,background-color,border-color,box-shadow,backdrop-filter] duration-500 data-solid:top-0 data-solid:border-band-line data-solid:bg-site-chrome-surface data-solid:shadow-(--shadow-md) data-solid:backdrop-blur-xl xs:px-6 sm:px-10 lg:px-14",
        "motion-reduce:transition-none",
      )}
    >
      <div className="relative mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-6">
        <Link
          href={waitlist ? WAITLIST_CHROME.href : "/"}
          aria-label={waitlist ? WAITLIST_CHROME.logoLabel : overlaysHero ? content.logoTopLabel : content.logoHomeLabel}
          className="-ml-2 flex min-h-tap items-center rounded-(--radius-button) px-2 outline-none transition-opacity duration-200 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-band-accent motion-reduce:transition-none"
        >
          <Wordmark src={content.logo} variant="primary" height={36} onScrim preload />
        </Link>

        {waitlist ? (
          <p className="absolute left-1/2 hidden -translate-x-1/2 font-data text-micro tracking-label text-band-accent uppercase lg:block">
            {WAITLIST_CHROME.statusLabel}
          </p>
        ) : <nav
          aria-label={content.primaryNavLabel}
          className="absolute left-1/2 hidden h-tap -translate-x-1/2 items-center gap-(--space-nav-control-gap) lg:flex"
        >
          {links.map((link) => {
            const active = isActivePath(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-tap items-center rounded-(--radius-button) px-(--space-nav-link-inline) text-small font-medium text-on-scrim-muted transition-[background-color,color,transform] duration-200 hover:-translate-y-px hover:bg-on-scrim/10 hover:text-on-scrim group-data-solid:text-band-muted group-data-solid:hover:bg-band-ink/10 group-data-solid:hover:text-band-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-band-accent motion-reduce:hover:translate-y-0 motion-reduce:transition-none",
                  active &&
                    "bg-on-scrim/10 text-band-accent group-data-solid:bg-band-ink/10 group-data-solid:text-band-accent",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>}

        <div className="flex items-center gap-2 sm:gap-(--space-nav-action-gap)">
          <ThemeToggle
            onScrim
            size="navigation"
            className="inline-flex self-center"
          />

          <Button
            asChild
            tone="nav"
            size="nav"
            className="hidden self-center sm:inline-flex"
            style={
              bookingActive
                ? ({
                    "--marketing-button-base": "var(--band-accent)",
                    "--marketing-button-ink": "var(--band-deep)",
                    "--marketing-button-fill": "var(--brand-hover)",
                    "--marketing-button-hover-ink": "var(--on-brand)",
                  } as CSSProperties)
                : undefined
            }
          >
            <Link
              href={actionHref}
              aria-current={bookingActive ? "page" : undefined}
            >
              {actionLabel}
            </Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                tone="scrim"
                aria-label={content.openMenuLabel}
                className="size-tap backdrop-blur-sm lg:hidden"
              >
                <MenuIcon aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="top"
              showCloseButton={false}
              className="home-mobile-menu !inset-0 !h-dvh !w-full !max-w-none gap-0 !border-0 bg-site-chrome-surface p-0 text-band-ink shadow-none sm:!max-w-none lg:hidden"
            >
              <SheetHeader className="flex min-h-nav shrink-0 flex-row items-center justify-between px-5 py-2 xs:px-6 sm:px-10">
                <SheetTitle className="flex items-center text-band-ink">
                  {waitlist ? (
                    <SheetClose asChild>
                      <Link href={WAITLIST_CHROME.href} aria-label={WAITLIST_CHROME.logoLabel} className="rounded-(--radius-control) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-band-accent">
                        <Wordmark src={content.logo} variant="primary" height={40} onScrim />
                      </Link>
                    </SheetClose>
                  ) : <Wordmark src={content.logo} variant="primary" height={40} onScrim />}
                </SheetTitle>
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    tone="scrim"
                    aria-label={content.closeMenuLabel}
                    className="size-tap xs:size-12"
                  >
                    <XIcon aria-hidden="true" className="size-5 xs:size-6" />
                  </Button>
                </SheetClose>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-8 xs:px-6 sm:px-10 sm:py-10">
                {waitlist ? (
                  <p className="font-data text-micro tracking-label text-band-accent uppercase">
                    {WAITLIST_CHROME.statusLabel}
                  </p>
                ) : <nav
                  aria-label={content.primaryNavLabel}
                  className="flex flex-col items-center gap-0.5"
                >
                  {links.map((link, index) => {
                    const active = isActivePath(pathname, link.href);

                    return (
                      <SheetClose asChild key={link.href}>
                        <Link
                          href={link.href}
                          aria-current={active ? "page" : undefined}
                          style={{
                            "--mobile-menu-delay": `${index * MARKETING_NAV_MENU_STAGGER_MS}ms`,
                          } as CSSProperties}
                          className={cn(
                            "home-mobile-menu-item inline-flex min-h-tap items-center justify-center rounded-(--radius-button) px-(--space-button-inline) font-display text-h3 font-medium text-band-ink transition-colors hover:text-band-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-band-accent sm:text-h2",
                            active && "bg-band-ink/10 text-band-accent",
                          )}
                        >
                          {link.label}
                        </Link>
                      </SheetClose>
                    );
                  })}
                </nav>}

                <div
                  style={{
                    "--mobile-menu-delay": `${links.length * MARKETING_NAV_MENU_STAGGER_MS}ms`,
                  } as CSSProperties}
                  className="home-mobile-menu-item mt-9"
                >
                  <SheetClose asChild>
                    <Button asChild tone="accent" size="nav">
                      <Link
                        href={actionHref}
                        aria-current={bookingActive ? "page" : undefined}
                      >
                        {actionLabel}
                      </Link>
                    </Button>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
