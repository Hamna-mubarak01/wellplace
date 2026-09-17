"use server";

import { z } from "zod";
import { requireReception } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { readWorkActivity, type WorkActivityResult } from "@/lib/db/queries/work-activity";

export async function loadWorkActivity(kind: "task" | "note", id: string): Promise<WorkActivityResult> {
  await requireReception();
  const parsed = z.object({ kind: z.enum(["task", "note"]), id: z.uuid() }).safeParse({ kind, id });
  if (!parsed.success) return { ok: false, message: "This task or note could not be identified. Reload the page and try again." };
  return readWorkActivity(await createClient(), parsed.data.kind, parsed.data.id);
}
