import { ConsolePage } from "@/components/console/console-page";
import { ConsoleCard } from "@/components/console/console-surface";
import { Skeleton } from "@/components/ui/skeleton";
import { CMS_PAGES } from "@/lib/config/cms/registry";
import { CMS_PAGE_GROUPS } from "@/lib/config/cms/types";

const GROUPS = CMS_PAGE_GROUPS.map((group) => ({
  group,
  cards: CMS_PAGES.filter((page) => page.group === group).length,
})).filter(({ cards }) => cards > 0);

export default function CmsLoading() {
  return (
    <ConsolePage title="Website content" className="@container/cms-overview min-w-0">
      <p role="status" className="sr-only">
        Loading website content
      </p>
      {GROUPS.map(({ group, cards }) => (
        <section key={group} aria-hidden="true" className="flex min-w-0 flex-col gap-3">
          <div className="flex min-h-tap items-center">
            <Skeleton className="h-4 w-24" />
          </div>
          <ul className="grid min-w-0 grid-cols-1 gap-4 @2xl/cms-overview:grid-cols-2 @6xl/cms-overview:grid-cols-3">
            {Array.from({ length: cards }, (_, index) => (
              <li key={index} className="min-w-0">
                <ConsoleCard className="h-full gap-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Skeleton className="h-4 w-32 max-w-full" />
                      <Skeleton className="h-3 w-56 max-w-full" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <Skeleton className="h-3 w-40 max-w-full" />
                    <Skeleton className="h-3 w-36 max-w-full" />
                  </div>
                </ConsoleCard>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ConsolePage>
  );
}
