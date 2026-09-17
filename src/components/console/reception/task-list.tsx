"use client";

import { useState } from "react";
import { ChevronRightIcon, ListChecksIcon } from "lucide-react";
import type { TaskRow } from "@/lib/db/queries/operations";
import { formatCalendarDayLong } from "@/lib/domain/time";
import { TASK_PRIORITY_LABEL } from "@/lib/config/reception";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/shared/button";
import { ConsoleEmpty } from "@/components/console/console-surface";
import { TaskActions } from "@/components/console/reception/task-actions";
import { WorkDetailDialog, TASK_STATUS_LABEL } from "@/components/console/reception/work-detail-dialog";
import type { StaffOption } from "@/components/console/reception/staff-assign-menu";

export interface TaskListProps {
  tasks: readonly TaskRow[];
  emptyMessage?: string;
  actionable?: boolean;
  staff?: readonly StaffOption[];
  onSelect?: (task: TaskRow) => void;
  today?: string;
}

export function TaskList({ tasks, emptyMessage, actionable = false, staff = [], onSelect, today }: TaskListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tasks.find((task) => task.id === selectedId);
  if (tasks.length === 0) return <ConsoleEmpty Icon={ListChecksIcon} title="No tasks to show" description={emptyMessage ?? "Try a different search or filter."} />;
  return <>
    <ul className="flex flex-col gap-3">
      {tasks.map((task) => {
        const finished = task.status === "done" || task.status === "cancelled";
        const overdue = !finished && !!today && !!task.dueOn && task.dueOn < today;
        return <li key={task.id} className="flex min-w-0 flex-col overflow-hidden rounded-(--radius-card) border border-border bg-surface-raised lg:flex-row">
          <Button variant="ghost" className="h-auto! min-w-0 flex-1 items-start justify-between gap-3 rounded-none p-4 text-left whitespace-normal" onClick={() => onSelect ? onSelect(task) : setSelectedId(task.id)} aria-label={`Open task: ${task.title}`}>
            <span className="min-w-0 flex-1">
              <span className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={task.status === "done" ? "border-success-border bg-success-wash text-success-ink" : "border-border-strong"}>{TASK_STATUS_LABEL[task.status]}</Badge>
                {(task.priority === "high" || task.priority === "urgent") && <Badge variant="outline" className="border-warning-border bg-warning-wash text-warning-ink">{TASK_PRIORITY_LABEL[task.priority]} priority</Badge>}
                {overdue && <Badge variant="outline" className="border-danger-border bg-danger-wash text-danger-ink">Overdue</Badge>}
              </span>
              <span className="block wrap-anywhere text-console-body font-medium text-text-primary">{task.title}</span>
              {task.note && <span className="mt-1 line-clamp-2 wrap-anywhere text-console-body font-normal text-text-secondary">{task.note}</span>}
              <span className="mt-2 block text-micro font-normal text-text-muted">{task.assignedToName ?? "Unassigned"}{task.dueOn ? ` · Due ${formatCalendarDayLong(task.dueOn)}` : " · No due date"}</span>
            </span>
            <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 self-center text-text-muted" />
          </Button>
          {!finished && (actionable || staff.length > 0) && <div className="flex shrink-0 items-center border-t border-border p-4 lg:border-t-0 lg:border-l"><TaskActions task={task} staff={staff} showStatusControls={actionable} /></div>}
        </li>;
      })}
    </ul>
    {selected && !onSelect && <WorkDetailDialog key={selected.id} task={selected} staff={staff} onClose={() => setSelectedId(null)} />}
  </>;
}
