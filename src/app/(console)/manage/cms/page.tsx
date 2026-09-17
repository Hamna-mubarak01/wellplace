import Link from "next/link";
import { Button } from "@/components/shared/button";
import type { Metadata } from "next";

import { CmsPageCard } from "@/components/console/cms/cms-page-card";
import { ConsolePage } from "@/components/console/console-page";
import { StatusChip } from "@/components/console/shared/status-chip";
import { requireManagement } from "@/lib/auth/session";
import { CMS_PAGES } from "@/lib/config/cms/registry";
import { CMS_PAGE_GROUPS } from "@/lib/config/cms/types";
import { fetchAllCmsContent } from "@/lib/db/queries/cms";
import { createClient } from "@/lib/db/server";

export const metadata: Metadata = {
  title: "Website content",
  robots: { index: false, follow: false },
};

export default async function CmsIndexPage() {
  await requireManagement();

  const supabase = await createClient();
  const records = await fetchAllCmsContent(supabase);
  const bySlug = new Map(records.map((record) => [record.slug, record]));

  return (
    <ConsolePage
      title="Website content"
      className="@container/cms-overview min-w-0"
    >
      <section aria-labelledby="cms-related-settings" className="flex flex-col gap-3">
        <h2 id="cms-related-settings" className="text-console-body font-semibold text-text-primary">Related content & settings</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/manage/messages">Email wording</Link></Button>
          <Button asChild variant="outline"><Link href="/manage/settings?group=contact">Contact information</Link></Button>
          <Button asChild variant="outline"><Link href="/manage/settings?group=booking">Opening hours</Link></Button>
          <Button asChild variant="outline"><Link href="/manage/pricing">Offers & add-ons</Link></Button>
          <Button asChild variant="outline"><Link href="/manage/settings?group=urgency">Availability notices</Link></Button>
        </div>
      </section>
      {CMS_PAGE_GROUPS.map((group) => {
        const pages = CMS_PAGES.filter((page) => page.group === group);
        if (pages.length === 0) return null;
        const headingId = `cms-group-${group.toLowerCase()}`;

        return (
          <section key={group} aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
            <h2
              id={headingId}
              className="flex min-h-tap items-center gap-2 text-console-body font-semibold text-text-primary"
            >
              {group}
              <StatusChip tone="neutral" className="font-data tabular-nums">
                {pages.length.toLocaleString("en-AE")}
              </StatusChip>
            </h2>
            <ul className="grid min-w-0 grid-cols-1 gap-4 @2xl/cms-overview:grid-cols-2 @6xl/cms-overview:grid-cols-3">
              {pages.map((page) => (
                <li key={page.slug} className="min-w-0">
                  <CmsPageCard page={page} record={bySlug.get(page.slug)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </ConsolePage>
  );
}
