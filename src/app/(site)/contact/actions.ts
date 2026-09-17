"use server";

import { headers } from "next/headers";

import type { ContactResult } from "@/app/(site)/contact/actions-types";
import { normaliseEmail } from "@/lib/domain/email";
import { sendContactNotification } from "@/lib/services/contact-notifications";
import { checkConfiguredRateLimit } from "@/lib/services/configured-rate-limit";
import { loadRateLimitSettings } from "@/lib/db/queries/rate-limit-settings";
import { contactSubmissionSchema } from "@/lib/validation/contact";

async function networkKey(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  return `contact:ip:${ip}`;
}

function addressKey(email: string): string {
  return `contact:email:${normaliseEmail(email)}`;
}

export async function submitContactEnquiry(raw: unknown): Promise<ContactResult> {
  const isSpam =
    typeof raw === "object" &&
    raw !== null &&
    "website" in raw &&
    typeof (raw as { website: unknown }).website === "string" &&
    (raw as { website: string }).website.length > 0;

  const parsed = contactSubmissionSchema.safeParse(
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

  try {
    const loaded = await loadRateLimitSettings();
    if (!loaded.ok) {
      console.error("[contact] spam protection settings could not be read:", loaded.message);
      return { status: "error" };
    }
    for (const key of [addressKey(parsed.data.email), await networkKey()]) {
      if (!checkConfiguredRateLimit("contact", loaded.snapshot, key).allowed) return { status: "rate_limited" };
    }
    if (isSpam) return { status: "sent" };
    const result = await sendContactNotification(parsed.data);
    return result.ok ? { status: "sent" } : { status: "error" };
  } catch (cause) {
    console.error("[contact] submission failed:", cause);
    return { status: "error" };
  }
}
