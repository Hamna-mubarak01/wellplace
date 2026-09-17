"use server";

import { after } from "next/server";
import { headers } from "next/headers";

import { createClient } from "@/lib/db/server";
import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import { calculateAge } from "@/lib/domain/age";
import { normaliseEmail } from "@/lib/domain/email";
import { checkConfiguredRateLimit } from "@/lib/services/configured-rate-limit";
import { loadRateLimitSettings } from "@/lib/db/queries/rate-limit-settings";
import { joinWaitlist } from "@/lib/services/waitlist-service";
import { sendWaitlistEmails } from "@/lib/services/waitlist-notifications";
import { waitlistSubmissionSchema } from "@/lib/validation/waitlist";
import type { WaitlistResult } from "@/app/(site)/waitlist/actions-types";

async function networkKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return `waitlist:ip:${ip}`;
}

function addressKey(email: string): string {
  return `waitlist:email:${normaliseEmail(email)}`;
}

export async function submitWaitlistEntry(
  raw: unknown,
): Promise<WaitlistResult> {
  const isSpam =
    typeof raw === "object" &&
    raw !== null &&
    "website" in raw &&
    typeof (raw as { website: unknown }).website === "string" &&
    (raw as { website: string }).website.length > 0;

  const parsed = waitlistSubmissionSchema.safeParse(
    typeof raw === "object" && raw !== null ? { ...raw, website: "" } : raw,
  );
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "form";
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return { status: "invalid", fieldErrors };
  }

  const minAge = requireSetting(EMPTY_SNAPSHOT, "booking.booker_min_age");
  const age = calculateAge(parsed.data.dateOfBirth);
  if (age < minAge) {
    return {
      status: "invalid",
      fieldErrors: {
        dateOfBirth: [`You need to be at least ${minAge} to join the waitlist.`],
      },
    };
  }

  try {
    const client = await createClient();
    const loaded = await loadRateLimitSettings();
    if (!loaded.ok) {
      console.error("[waitlist] spam protection settings could not be read:", loaded.message);
      return { status: "error" };
    }
    for (const key of [addressKey(parsed.data.email), await networkKey()]) {
      if (!checkConfiguredRateLimit("waitlist", loaded.snapshot, key).allowed) return { status: "rate_limited" };
    }
    const result = await joinWaitlist(client, parsed.data, isSpam);

    switch (result.outcome) {
      case "joined":
        if (!isSpam && result.submittedAt) {
          const { submittedAt, entryId } = result;
          after(async () => {
            await sendWaitlistEmails({
              submission: parsed.data,
              submittedAt,
              reference: entryId,
            });
          });
        }
        return { status: "joined" };
      case "already_on_list":
        return { status: "already_on_list" };
      case "failed":
        console.error("[waitlist] submission failed:", result.reason);
        return { status: "error" };
    }
  } catch (cause) {
    console.error("[waitlist] unexpected fault:", cause);
    return { status: "error" };
  }
}
