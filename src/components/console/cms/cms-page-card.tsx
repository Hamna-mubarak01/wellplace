import Link from "next/link";
import { CheckCircle2Icon, ClockIcon } from "lucide-react";

import { CmsIcon } from "@/components/console/cms/cms-icon";
import { ConsoleCard } from "@/components/console/console-surface";
import { StatusChip } from "@/components/console/shared/status-chip";
import type { CmsPageSpec } from "@/lib/config/cms/types";
import type { CmsContentRecord } from "@/lib/db/queries/cms";
import { formatDubaiDateTime } from "@/lib/domain/time";

export interface CmsPageCardProps {
  page: CmsPageSpec;
  record: CmsContentRecord | undefined;
}

export function CmsPageCard({ page, record }: CmsPageCardProps) {
  const published = record?.status === "published" && record.publishedAt;
  const titleId = `cms-page-${page.slug}`;

  return (
    <ConsoleCard
      aria-labelledby={titleId}
      data-tap-area=""
      className="@container relative h-full gap-4 p-4 transition-colors duration-150 hover:border-border-hover hover:bg-surface-hover has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-focus-ring motion-reduce:transition-none"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-48 items-start gap-2.5">
          <CmsIcon name={page.icon} className="mt-0.5 size-4 shrink-0 text-brand" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3
              id={titleId}
              className="min-w-0 text-console-body font-semibold wrap-break-word text-text-primary"
            >
              <Link
                href={`/manage/cms/${page.slug}`}
                className="rounded-(--radius-inner) outline-none after:absolute after:inset-0 after:rounded-(--radius-card)"
              >
                {page.label}
                <span className="sr-only">, edit content</span>
              </Link>
            </h3>
            <p className="text-micro text-pretty text-text-secondary">{page.description}</p>
          </div>
        </div>
        <StatusChip
          tone={published ? "success" : "neutral"}
          Icon={published ? CheckCircle2Icon : ClockIcon}
          className="shrink-0"
        >
          {published ? "Published" : "Draft"}
        </StatusChip>
      </div>

      <dl className="mt-auto grid grid-cols-1 gap-x-4 gap-y-3 border-t border-border pt-3 @xs:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-console-label tracking-label text-text-muted uppercase">Last updated</dt>
          <dd className="min-w-0 font-data text-console-table tabular-nums break-words text-text-primary">
            {record ? formatDubaiDateTime(record.updatedAt) : "Not yet edited"}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-console-label tracking-label text-text-muted uppercase">Published</dt>
          <dd className="min-w-0 font-data text-console-table tabular-nums break-words text-text-primary">
            {record?.publishedAt ? formatDubaiDateTime(record.publishedAt) : "Using built-in content"}
          </dd>
        </div>
      </dl>
    </ConsoleCard>
  );
}
