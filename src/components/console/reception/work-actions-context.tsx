"use client";

import { createContext, useContext, type ReactNode } from "react";

import { assignTask, createTask, setTaskStatus } from "@/app/(console)/reception/actions";
import { loadWorkActivity } from "@/app/(console)/reception/tasks/actions";

export interface WorkActions {
  readonly createTask: typeof createTask;
  readonly assignTask: typeof assignTask;
  readonly setTaskStatus: typeof setTaskStatus;
  readonly loadWorkActivity: typeof loadWorkActivity;
  readonly canHandOver: boolean;
}

const RECEPTION_WORK_ACTIONS: WorkActions = {
  createTask,
  assignTask,
  setTaskStatus,
  loadWorkActivity,
  canHandOver: true,
};

const WorkActionsContext = createContext<WorkActions>(RECEPTION_WORK_ACTIONS);

export function WorkActionsProvider({ value, children }: { value: WorkActions; children: ReactNode }) {
  return <WorkActionsContext value={value}>{children}</WorkActionsContext>;
}

export function useWorkActions(): WorkActions {
  return useContext(WorkActionsContext);
}
