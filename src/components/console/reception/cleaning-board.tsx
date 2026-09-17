import { SparklesIcon } from "lucide-react";

import type { CleaningRow, CleaningStatus } from "@/lib/db/queries/operations";
import { formatDubaiTime } from "@/lib/domain/time";
import { Badge } from "@/components/ui/badge";
import { CleaningActions } from "@/components/console/reception/cleaning-actions";
import type { StaffOption } from "@/components/console/reception/staff-assign-menu";
import { ConsoleEmpty } from "@/components/console/console-surface";

const STATUS_LABEL: Readonly<Record<CleaningStatus, string>> = {
  pending: "Not started",
  in_progress: "In progress",
  confirmed: "Finished",
};

const STATUS_CLASS: Readonly<Record<CleaningStatus, string>> = {
  pending: "border-warning-border bg-warning-wash text-warning-ink",
  in_progress: "border-info-border bg-info-wash text-info-ink",
  confirmed: "border-success-border bg-success-wash text-success-ink",
};

export interface CleaningBoardProps {
  tasks: readonly CleaningRow[];
  overdueAfterMinutes: number;
  now: string;
  staff?: readonly StaffOption[];
  emptyMessage?: string;
}

export function CleaningBoard({
  tasks,
  overdueAfterMinutes,
  now,
  staff = [],
  emptyMessage,
}: CleaningBoardProps) {
  if (tasks.length === 0) {
    return (
      <ConsoleEmpty
        Icon={SparklesIcon}
        title="No cleaning due on this day"
        description={emptyMessage ?? "A task appears here when a suite comes free."}
      />
    );
  }

  const instant = Date.parse(now);

  return (
    <ul className="flex min-w-0 flex-col divide-y divide-border">
      {tasks.map((task) => {
        const overdue = task.confirmedAt === null && (instant - Date.parse(task.dueFrom)) / 60_000 >= overdueAfterMinutes;
        return <li key={task.id} className="flex min-w-0 flex-col gap-3 py-4 first:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-data text-console-body">Suite {task.suiteNumber ?? "—"}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`text-micro ${STATUS_CLASS[task.status]}`}>{STATUS_LABEL[task.status]}</Badge>
              {overdue && <Badge variant="outline" className="border-danger-border bg-danger-wash text-micro text-danger-ink">Overdue</Badge>}
            </div>
          </div>
          <p className="text-micro text-text-secondary">Due {formatDubaiTime(task.dueFrom)} · {task.assignedToName ?? "Unassigned"}{task.confirmedAt ? ` · Finished ${formatDubaiTime(task.confirmedAt)}` : ""}</p>
          <CleaningActions task={task} staff={staff} />
        </li>;
      })}
    </ul>
  );
}
