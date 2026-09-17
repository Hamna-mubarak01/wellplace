import { ConsolePage } from "@/components/console/console-page";
import { DetailSection } from "@/components/console/shared/detail-section";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { SETTINGS_PANELS } from "@/lib/config/settings-panels";

const SECTIONS = [...new Set(SETTINGS_PANELS.map((panel) => panel.section))].map((section) => ({
  section,
  rows: SETTINGS_PANELS.filter((panel) => panel.section === section).length,
}));

export default function SettingsLoading() {
  return (
    <ConsolePage title="Settings">
      <div aria-busy="true" className="flex min-w-0 flex-col gap-6">
        <p role="status" className="sr-only">Loading settings</p>
        <FilterBarSkeleton controls={0} />
        {SECTIONS.map(({ section, rows }) => (
          <DetailSection key={section} title={section} flush>
            <ul aria-hidden="true" className="divide-y divide-border border-t border-border">
              {Array.from({ length: rows }, (_, index) => (
                <li key={index} className="flex min-h-20 items-center gap-4 px-4 py-4 sm:px-5">
                  <Skeleton className="size-tap shrink-0 rounded-(--radius-control)" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-40 max-w-full" />
                    <Skeleton className="h-3 w-64 max-w-full" />
                  </div>
                </li>
              ))}
            </ul>
          </DetailSection>
        ))}
      </div>
    </ConsolePage>
  );
}
