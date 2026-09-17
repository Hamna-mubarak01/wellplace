"use server";

import { suiteConfigurationSchema, type SuiteConfigurationInput } from "@/lib/validation/suite-management";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { consoleEdit, reasonSchema } from "@/lib/validation/audit-reason";
import { suiteStatusChangeSchema } from "@/lib/validation/suite-status";

import { requireManagement } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  MANAGEMENT_SUITE_PRIORITY_INVALID,
  deleteSuite,
  retireSuite,
  returnSuiteToService,
  setSuiteDetails,
  saveSuiteConfiguration,
  setSuiteStatus,
  type BookingMutation,
} from "@/lib/db/rpc";
import { SUITE_NOTE_MAX_LENGTH, SUITE_PRIORITY_MIN, SUITE_PRIORITY_MAX } from "@/lib/config/suite-management";
import type { Database } from "@/types/database.generated";

export type SuiteActionResult = { ok: true } | { ok: false; message: string; blockedSuiteIds?: string[] };

const detailsSchema = z.object({
  suiteId: z.uuid("That suite is not valid."),
  priority: z.number().int().min(SUITE_PRIORITY_MIN).max(SUITE_PRIORITY_MAX).nullable(),
  internalNote: z.string().trim().max(SUITE_NOTE_MAX_LENGTH).nullable(),
});


const lifecycleSchema = z.object({
  suiteId: z.uuid("That suite is not valid."),
  reason: reasonSchema,
});

function refreshSurfaces(): void {
  revalidatePath("/manage/suites", "layout");
  revalidatePath("/book");
  revalidatePath("/reception");
  revalidatePath("/reception/board");
  revalidatePath("/reception/bookings");
}

function toResult<T>(result: BookingMutation<T>): SuiteActionResult {
  switch (result.outcome) {
    case "ok":
      refreshSurfaces();
      return { ok: true };
    case "no_suite":
      return { ok: false, message: "No suite matched. Nothing was changed." };
    case "refused":
      if (result.code === MANAGEMENT_SUITE_PRIORITY_INVALID) {
        return { ok: false, message: result.message };
      }
      return { ok: false, message: result.message };
    case "failed":
      return { ok: false, message: result.message };
  }
}

export async function changeSuiteStatus(input: {
  suiteId: string;
  status: Database["public"]["Enums"]["suite_status"];
  reason?: string;
}): Promise<SuiteActionResult> {
  const parsed = suiteStatusChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  await requireManagement();
  const supabase = await createClient();

  return toResult(
    await setSuiteStatus(supabase, {
      ...parsed.data,
      reason: parsed.data.reason ?? consoleEdit("Suite status"),
    }),
  );
}

export async function changeSuiteDetails(input: {
  suiteId: string;
  priority: number | null;
  internalNote: string | null;
}): Promise<SuiteActionResult> {
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  await requireManagement();
  const supabase = await createClient();

  return toResult(
    await setSuiteDetails(supabase, {
      suiteId: parsed.data.suiteId,
      priority: parsed.data.priority,
      internalNote:
        parsed.data.internalNote && parsed.data.internalNote.length > 0
          ? parsed.data.internalNote
          : null,
      reason: consoleEdit("Suite details"),
    }),
  );
}

export async function saveSuite(input: SuiteConfigurationInput): Promise<SuiteActionResult> {
  await requireManagement();
  const parsed = suiteConfigurationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const result = await saveSuiteConfiguration(await createClient(), {
    ...parsed.data, reason: consoleEdit(parsed.data.create ? "Suite added" : "Suite setup updated"),
  });
  if (result.outcome !== "ok") return { ok: false,
    message: result.outcome === "no_suite" ? "This suite could not be found. Refresh the list." : result.message };
  revalidatePath("/manage/suites", "layout");
  revalidatePath("/reception", "layout");
  revalidatePath("/book");
  return { ok: true };
}

export async function retireManagedSuite(input: {
  suiteId: string;
  reason: string;
}): Promise<SuiteActionResult> {
  await requireManagement();
  const parsed = lifecycleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  return toResult(await retireSuite(await createClient(), parsed.data));
}

export async function returnManagedSuiteToService(input: {
  suiteId: string;
  reason: string;
}): Promise<SuiteActionResult> {
  await requireManagement();
  const parsed = lifecycleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  return toResult(await returnSuiteToService(await createClient(), parsed.data));
}

export async function deleteManagedSuite(input: {
  suiteId: string;
  reason: string;
}): Promise<SuiteActionResult> {
  await requireManagement();
  const parsed = lifecycleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  return toResult(await deleteSuite(await createClient(), parsed.data));
}
