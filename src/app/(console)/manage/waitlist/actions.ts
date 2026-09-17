"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { requireManagement } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { eraseWaitlistEntry } from "@/lib/db/rpc";
import { sendWaitlistEmails } from "@/lib/services/waitlist-notifications";
import {
  addWaitlistLeadManually,
  manualSubmissionForEmail,
} from "@/lib/services/waitlist-service";
import { waitlistSubmissionSchema } from "@/lib/validation/waitlist";

export type LeadActionResult =
  | { ok: true }
  | { ok: false; message: string };

const schema = z.object({
  entryId: z.uuid(),
  reason: z.string().trim().max(500).optional(),
});

export async function eraseLead(raw: {
  entryId: string;
  reason?: string;
}): Promise<LeadActionResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "That entry reference is not valid." };
  }

  await requireManagement();

  const supabase = await createClient();
  const { entryId, reason } = parsed.data;

  const result = await eraseWaitlistEntry(
    supabase,
    entryId,
    reason?.length ? reason : null,
  );

  if (!result.ok) {
    console.error("[console] erase failed:", result.message);
    return {
      ok: false,
      message:
        result.code === "42501"
          ? "You do not have permission for that."
          : "That did not go through. Try again.",
    };
  }

  revalidatePath("/manage/waitlist");
  return { ok: true };
}

const MAX_BULK_DELETE = 100;

const bulkSchema = z.object({
  entryIds: z.array(z.uuid()).min(1).max(MAX_BULK_DELETE),
  reason: z.string().trim().max(500).optional(),
});

export type BulkEraseResult =
  | { ok: true; deleted: number; failed: number }
  | { ok: false; message: string };

export async function eraseLeads(raw: {
  entryIds: string[];
  reason?: string;
}): Promise<BulkEraseResult> {
  const parsed = bulkSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "That selection is not valid." };
  }

  await requireManagement();

  const supabase = await createClient();
  const { entryIds, reason } = parsed.data;
  const why = reason?.length ? reason : "Deleted from the console";

  let deleted = 0;
  let failed = 0;
  let denied = false;

  for (const entryId of entryIds) {
    const result = await eraseWaitlistEntry(supabase, entryId, why);
    if (result.ok) {
      deleted += 1;
      continue;
    }
    failed += 1;
    if (result.code === "42501") denied = true;
    console.error("[console] bulk erase failed for", entryId, result.message);
  }

  if (deleted === 0 && denied) {
    return { ok: false, message: "You do not have permission for that." };
  }
  if (deleted === 0) {
    return { ok: false, message: "That did not go through. Try again." };
  }

  revalidatePath("/manage/waitlist");
  return { ok: true, deleted, failed };
}

const manualLeadSchema = waitlistSubmissionSchema
  .pick({
    salutation: true,
    firstName: true,
    lastName: true,
    email: true,
    dateOfBirth: true,
    phone: true,
  })
  .extend({ reason: z.string().trim().max(500).optional() });

export type AddLeadResult =
  | { status: "added" }
  | { status: "duplicate" }
  | { status: "invalid"; fieldErrors: Record<string, string> }
  | { status: "error" };

export async function addLeadManually(raw: unknown): Promise<AddLeadResult> {
  const parsed = manualLeadSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "invalid", fieldErrors };
  }

  await requireManagement();

  const { dateOfBirth, phone, reason, ...rest } = parsed.data;
  const pad = (n: number) => String(n).padStart(2, "0");

  const input = {
    ...rest,
    dateOfBirth: `${dateOfBirth.year}-${pad(dateOfBirth.month)}-${pad(dateOfBirth.day)}`,
    phoneE164: phone.e164,
    phoneCountry: phone.countryIso2,
    reason: reason ?? "Added manually from the console",
  };

  const supabase = await createClient();
  const result = await addWaitlistLeadManually(supabase, input);

  if (result.outcome === "failed") {
    console.error("[console] manual waitlist add failed:", result.reason);
    return { status: "error" };
  }

  if (result.outcome === "duplicate") return { status: "duplicate" };

  revalidatePath("/manage/waitlist");

  const { entryId, submittedAt } = result;
  after(async () => {
    await sendWaitlistEmails({
      submission: manualSubmissionForEmail(input),
      submittedAt,
      reference: entryId,
    });
  });

  return { status: "added" };
}
