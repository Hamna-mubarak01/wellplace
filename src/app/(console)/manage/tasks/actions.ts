"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { BookingActionResult } from "@/app/(console)/reception/actions";
import { requireManagement } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { readWorkActivity, type WorkActivityResult } from "@/lib/db/queries/work-activity";
import {
  assignTask as assignTaskRpc,
  createTask as createTaskRpc,
  updateTaskStatus as updateTaskStatusRpc,
  type BookingMutation,
} from "@/lib/db/rpc";
import { assignmentInput, newTaskInput, taskStatusInput } from "@/lib/validation/reception-action-inputs";
import type { Database } from "@/types/database.generated";

const TASK_PATHS = ["/manage/tasks", "/reception/tasks", "/reception"] as const;

function settle<T>(result: BookingMutation<T>): BookingActionResult {
  if (result.outcome === "ok") {
    for (const path of TASK_PATHS) revalidatePath(path);
    return { ok: true };
  }
  if (result.outcome === "no_suite") return { ok: false, message: "That change could not be made. Refresh the page and try again." };
  return { ok: false, message: result.message };
}

export async function createManagedTask(input: {
  title: string;
  note: string;
  assignedTo: string | null;
  dueOn: string | null;
  priority: Database["public"]["Enums"]["task_priority"];
}): Promise<BookingActionResult> {
  await requireManagement();
  const parsed = newTaskInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  return settle(
    await createTaskRpc(await createClient(), {
      title: parsed.data.title,
      note: input.note.trim(),
      assignedTo: input.assignedTo,
      dueOn: input.dueOn,
      priority: input.priority,
    }),
  );
}

export async function assignManagedTask(taskId: string, staffId: string | null): Promise<BookingActionResult> {
  await requireManagement();
  const parsed = assignmentInput.safeParse({ taskId, staffId });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  return settle(await assignTaskRpc(await createClient(), { taskId, staffId }));
}

export async function setManagedTaskStatus(
  taskId: string,
  status: Database["public"]["Enums"]["task_status"],
  note: string,
): Promise<BookingActionResult> {
  await requireManagement();
  const parsed = taskStatusInput.safeParse({ taskId, status, note });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  return settle(await updateTaskStatusRpc(await createClient(), { taskId, status, note }));
}

export async function loadManagedWorkActivity(kind: "task" | "note", id: string): Promise<WorkActivityResult> {
  await requireManagement();
  const parsed = z.object({ kind: z.enum(["task", "note"]), id: z.uuid() }).safeParse({ kind, id });
  if (!parsed.success) return { ok: false, message: "This task or note could not be identified. Reload the page and try again." };
  return readWorkActivity(await createClient(), parsed.data.kind, parsed.data.id);
}
