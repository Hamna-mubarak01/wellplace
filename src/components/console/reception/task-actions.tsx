"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";

import type { BookingActionResult } from "@/app/(console)/reception/actions";
import { useWorkActions } from "@/components/console/reception/work-actions-context";
import type { TaskRow } from "@/lib/db/queries/operations";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { Button } from "@/components/shared/button";
import {
  StaffAssignMenu,
  type StaffOption,
} from "@/components/console/reception/staff-assign-menu";

export interface TaskActionsProps {
  onPendingChange?: (pending: boolean) => void;
  task: TaskRow;
  staff?: readonly StaffOption[];
  showStatusControls?: boolean;
  onDone?: () => void;
}

export function TaskActions({
  task,
  staff = [],
  showStatusControls = true,
  onPendingChange,
  onDone,
}: TaskActionsProps) {
  const router = useRouter();
  const { assignTask, setTaskStatus } = useWorkActions();
  const [pending, start] = useTransition();
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);

  if (task.status === "done" || task.status === "cancelled") return null;

  const run = (perform: () => Promise<BookingActionResult>, success: string, finished?: () => void) =>
    start(async () => {
      let result: BookingActionResult;

      try {
        result = await perform();
      } catch (cause) {
        console.error("[console] task action threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success(success);
        router.refresh();
        finished?.();
        return;
      }

      toast.error("Nothing was changed", { description: result.message });
    });

  return (
    <div className="flex flex-wrap gap-2">
      {staff.length > 0 && (
        <StaffAssignMenu
          staff={staff}
          assignedTo={task.assignedTo}
          disabled={pending}
          triggerLabel={task.assignedTo === null ? "Assign" : "Reassign"}
          menuLabel="Give this task to"
          unassignLabel="Leave it unassigned"
          onAssign={(staffId) =>
            run(() => assignTask(task.id, staffId), "Task assigned")
          }
          onUnassign={() =>
            run(() => assignTask(task.id, null), "Task left unassigned")
          }
        />
      )}

      {showStatusControls && (
        <Button
          hoverEffect="sweep"
          type="button"
          size="sm"
          disabled={pending}
          className="min-h-tap"
          onClick={() => run(() => setTaskStatus(task.id, "done", ""), "Task completed", onDone)}
        >
          {pending ? "Saving…" : "Mark done"}
        </Button>
      )}
    </div>
  );
}
