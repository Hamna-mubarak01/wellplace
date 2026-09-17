"use client";

import {
  assignManagedTask,
  createManagedTask,
  loadManagedWorkActivity,
  setManagedTaskStatus,
} from "@/app/(console)/manage/tasks/actions";
import { TasksWorkspace } from "@/components/console/reception/tasks-workspace";
import { WorkActionsProvider, type WorkActions } from "@/components/console/reception/work-actions-context";
import type { StaffOption } from "@/components/console/reception/staff-assign-menu";
import type { ShiftNoteListing, TaskListing } from "@/lib/db/queries/operations";

const MANAGEMENT_WORK_ACTIONS: WorkActions = {
  createTask: createManagedTask,
  assignTask: assignManagedTask,
  setTaskStatus: setManagedTaskStatus,
  loadWorkActivity: loadManagedWorkActivity,
  canHandOver: false,
};

export function ManageTasksWorkspace(props: {
  tasks: TaskListing;
  notes: ShiftNoteListing;
  staff: readonly StaffOption[];
  currentStaffId: string;
  today: string;
}) {
  return (
    <WorkActionsProvider value={MANAGEMENT_WORK_ACTIONS}>
      <TasksWorkspace {...props} canWriteNotes={false} />
    </WorkActionsProvider>
  );
}
