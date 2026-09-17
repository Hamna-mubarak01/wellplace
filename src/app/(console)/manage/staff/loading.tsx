import { UsersRoundIcon } from "lucide-react";

import { ConsolePage } from "@/components/console/console-page";
import { StatGridSkeleton } from "@/components/console/shared/stat-grid-skeleton";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { DetailSection } from "@/components/console/shared/detail-section";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";

const STATS = ["Console access", "Management", "Reception", "Deactivated", "Invitations"] as const;

const HEADERS = ["Name", "Role", "Access", "Permissions", "Added"] as const;

export default function StaffLoading() {
  return (
    <ConsolePage title="Staff">
      <StatGridSkeleton labels={STATS} columns={5} />
      <DetailSection title="Console access" Icon={UsersRoundIcon}>
        <div className="flex min-w-0 flex-col gap-4">
          <FilterBarSkeleton controls={2} />
          <ConsoleDataTableSkeleton headers={HEADERS} rows={5} actionsHeader="Actions" />
        </div>
      </DetailSection>
    </ConsolePage>
  );
}
