import Link from "next/link";
import { MailIcon } from "lucide-react";

import { CookieSettingsDialog } from "@/components/marketing/cookie-settings";
import { Wordmark } from "@/components/shared/wordmark";
import { SocialIcon } from "@/components/shared/social-icon";
import { PRIVACY_CONTACT } from "@/lib/config/entity";
import { Button } from "@/components/shared/button";
import { LEGAL_INDEX_HREF } from "@/lib/config/legal";
import type { MarketingNavigationLink } from "@/lib/config/marketing";
import type { ResolvedFooter } from "@/lib/config/cms/site-chrome-content";
import { SITE_NAME } from "@/lib/config/seo";
import { WAITLIST_CHROME, type SiteChromeVariant } from "@/lib/config/site-chrome";
import { cn } from "@/lib/utils";

const COLUMN_HEADING =
  "font-data text-fine font-medium tracking-label text-band-muted uppercase sm:text-micro";

const FOOTER_LINK =
  "flex min-h-tap items-center rounded-(--radius-control) py-0.5 text-fine text-band-ink/80 transition-colors hover:text-band-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-band-accent sm:py-1 sm:text-small";

export interface HomeFooterProps {
  logo?: string;
  links: readonly MarketingNavigationLink[];
  content: ResolvedFooter;
  variant?: SiteChromeVariant;
}

export function HomeFooter({ links, content, logo, variant = "site" }: HomeFooterProps) {
  const waitlist = variant === "waitlist";
  const year = new Date().getFullYear();
  const privacyEmailBreak = PRIVACY_CONTACT.indexOf("@") + 1;

  return (
    <footer className="home-floating-safe bg-site-chrome-surface px-5 pt-10 pb-6 text-band-ink transition-colors duration-500 motion-reduce:transition-none xs:px-6 sm:px-10 sm:pt-14 sm:pb-9 lg:px-14 lg:pt-16">
      <div className="mx-auto grid w-full max-w-7xl gap-6 border-b border-band-line pb-6 sm:gap-8 sm:pb-8 md:grid-cols-[1.15fr_1fr] md:gap-12 md:pb-10 lg:gap-20">
        <div className="flex max-w-sm flex-col items-start gap-2.5 sm:gap-3.5">
          <Link
            href={waitlist ? WAITLIST_CHROME.href : "/"}
            aria-label={waitlist ? WAITLIST_CHROME.logoLabel : content.backToTopLabel}
            className="rounded-(--radius-control) outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-band-accent"
          >
            <Wordmark src={logo} variant="primary" height={42} onScrim />
          </Link>
          {waitlist && (
            <p className="font-data text-fine tracking-label text-band-accent uppercase sm:text-micro">
              {WAITLIST_CHROME.statusLabel}
            </p>
          )}
          <p className="text-fine text-band-muted text-pretty sm:text-small">
            {content.tagline}
          </p>
          {content.socialLinks.length > 0 && (
            <nav aria-label={content.socialHeading} className="flex flex-col gap-3">
              <h2 className={COLUMN_HEADING}>{content.socialHeading}</h2>
              <div className="flex flex-wrap gap-3">
                {content.socialLinks.map((link) => (
                  <Button key={`${link.icon}-${link.href}`} asChild variant="ghost" size="icon" tone="scrim" className="footer-social-link">
                    <a href={link.href} aria-label={link.label} title={link.label} target="_blank" rel="noopener noreferrer">
                      <SocialIcon name={link.icon} />
                    </a>
                  </Button>
                ))}
              </div>
            </nav>
          )}
        </div>

        <div className={cn("grid gap-x-1 sm:gap-x-3 lg:gap-x-6", waitlist ? "grid-cols-1" : "grid-cols-2")}>
          {!waitlist && <nav aria-label={content.exploreHeading} className="flex flex-col gap-1">
            <h2 className={`${COLUMN_HEADING} mb-1`}>{content.exploreHeading}</h2>
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={FOOTER_LINK}>
                {link.label}
              </Link>
            ))}
          </nav>}

          <div className="flex min-w-0 flex-col gap-1">
            <h2 className={`${COLUMN_HEADING} mb-1`}>{content.companyHeading}</h2>
            <Link href={LEGAL_INDEX_HREF} className={FOOTER_LINK}>
              {content.legalLabel}
            </Link>
            <a
              href={`mailto:${PRIVACY_CONTACT}`}
              className={`${FOOTER_LINK} inline-flex min-w-0 items-center gap-1`}
            >
              <MailIcon aria-hidden="true" className="size-3 shrink-0 lg:size-3.5" />
              <span className="min-w-0 text-micro [overflow-wrap:anywhere] lg:text-small">
                {PRIVACY_CONTACT.slice(0, privacyEmailBreak)}<wbr />{PRIVACY_CONTACT.slice(privacyEmailBreak)}
              </span>
            </a>
            <CookieSettingsDialog
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  className={`${FOOTER_LINK} footer-cookie-link h-auto cursor-pointer justify-start px-0 text-left font-normal`}
                >
                  {content.cookieSettingsLabel}
                </Button>
              }
            />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-1.5 pt-5 text-left xs:flex-row xs:items-center xs:justify-between xs:gap-4 sm:pt-6">
        <p className="text-fine text-band-muted">
          © {year} {SITE_NAME}
        </p>
        <p className="text-fine text-band-muted">{content.localityLine}</p>
      </div>
    </footer>
  );
}
