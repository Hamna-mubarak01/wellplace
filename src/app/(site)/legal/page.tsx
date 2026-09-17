import { getLegalContent } from "@/lib/services/site-content";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { LegalText } from "@/components/marketing/legal-text";
import {
  SiteFooterSlot,
  SiteNavSlot,
} from "@/components/marketing/site-chrome-slots";
import { LegalToc } from "@/components/marketing/legal-toc";
import { JsonLd } from "@/components/marketing/structured-data";
import { Button } from "@/components/shared/button";
import {
  LEGAL_TEXTS_DATE,
  type LegalDocument,
} from "@/lib/config/legal";
import { LAUNCH_MODE, SITE_NAME, breadcrumbJsonLd, pageMetadata } from "@/lib/config/seo";
import { WAITLIST_CHROME, type SiteChromeVariant } from "@/lib/config/site-chrome";

const TITLE = "Legal";
const DESCRIPTION =
  "WellPlace's Legal Terms, Privacy Policy, Marketing Terms and Cookie Policy, in one place.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/legal",
});

const CHROME_VARIANT: SiteChromeVariant = LAUNCH_MODE === "waitlist" ? "waitlist" : "site";
const BACK_HREF = LAUNCH_MODE === "waitlist" ? WAITLIST_CHROME.href : "/";
const BACK_LABEL = LAUNCH_MODE === "waitlist" ? WAITLIST_CHROME.backLabel : "Back to WellPlace";

const SHELL = "mx-auto w-full max-w-6xl px-6 sm:px-10";

const DOCUMENT_SHADOW = { boxShadow: "var(--shadow-sm)" } as const;

const READER_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function lastUpdatedLine(entry: LegalDocument): string {
  if (entry.lastUpdated) return entry.lastUpdated;
  return `Last updated ${READER_DATE.format(new Date(`${LEGAL_TEXTS_DATE}T00:00:00Z`))}`;
}

export default async function LegalPage() {
  const { documents } = await getLegalContent();
  const ordered = [...documents].sort((a, b) => a.ordinal - b.ordinal);
  return (
    // [§Owner legal background correction, 15 Sep] Uniform page surface, distinct from the matching nav and footer.
    <div className="flex min-h-full flex-1 flex-col bg-surface-base dark:bg-surface-sunken">
      <SiteNavSlot variant={CHROME_VARIANT} />
      <main className="flex-1 pt-nav">
        <div className={`${SHELL} flex flex-col gap-4 pt-2 pb-8 sm:gap-5 sm:pb-10`}>
          <Button
            asChild
            variant="ghost"
            className="-ml-2.5 w-fit text-fine text-text-secondary"
          >
            <Link href={BACK_HREF}>
              <ArrowLeftIcon aria-hidden="true" />
              {BACK_LABEL}
            </Link>
          </Button>
          <div className="flex flex-col gap-3">
            <p className="text-label font-medium tracking-label text-text-muted uppercase">
              {SITE_NAME}
            </p>
            <h1 className="font-display text-h1 font-bold tracking-display text-text-primary text-pretty">
              {TITLE}
            </h1>
            <p className="max-w-lead text-lead text-text-secondary text-pretty">
              {DESCRIPTION}
            </p>
          </div>
        </div>
        <div className={`${SHELL} pb-16 sm:pb-20 lg:pb-24`}>
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
                        <LegalToc
              items={ordered.map(({ slug, title }) => ({ slug, title }))}
              className="hidden lg:sticky lg:top-8 lg:block lg:w-56 lg:shrink-0"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-8 sm:gap-10">
              {ordered.map((entry) => (
                <section
                  key={entry.slug}
                  id={entry.slug}
                  aria-labelledby={`${entry.slug}-heading`}
                  className="scroll-mt-8"
                >
                  <article
                    style={DOCUMENT_SHADOW}
                    className="flex flex-col gap-6 rounded-(--radius-modal) border border-border bg-surface-raised p-6 sm:gap-7 sm:p-10"
                  >
                    <div className="flex flex-col gap-2">
                      <h2
                        id={`${entry.slug}-heading`}
                        className="font-display text-h2 font-bold tracking-display text-text-primary text-pretty"
                      >
                        {entry.title}
                      </h2>
                      <p className="text-small text-text-muted">
                        {lastUpdatedLine(entry)}
                      </p>
                    </div>

                                        {entry.paragraphs.map((paragraph, index) => (
                      <p
                        key={paragraph}
                        className={
                          index === 0
                            ? "text-lead text-text-primary text-pretty"
                            : "text-body text-text-secondary text-pretty"
                        }
                      >
                        <LegalText text={paragraph} slug={entry.slug} />
                      </p>
                    ))}
                  </article>
                </section>
              ))}
            </div>
          </div>
        </div>
      </main>
      <SiteFooterSlot variant={CHROME_VARIANT} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: SITE_NAME, path: BACK_HREF },
          { name: TITLE, path: "/legal" },
        ])}
      />
    </div>
  );
}
