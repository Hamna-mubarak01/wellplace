import { publishedLegalVersion } from "@/lib/db/queries/legal-content";
import { TERMS_ACCEPTANCE } from "@/lib/config/consent";
import {
  createWaitlistEntryManual,
  submitWaitlistEntry,
} from "@/lib/db/rpc";
import type {
  ManualWaitlistEntryInput,
  WaitlistSubmissionInput,
} from "@/lib/db/rpc";
import type { WellPlaceClient } from "@/lib/db/types";
import type { WaitlistSubmission } from "@/lib/validation/waitlist";

export type WaitlistOutcome = "joined" | "already_on_list" | "failed";

const pad = (n: number) => String(n).padStart(2, "0");

function toIsoDate({ year, month, day }: WaitlistSubmission["dateOfBirth"]): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function toRpcInput(
  submission: WaitlistSubmission,
  isSpam: boolean,
): WaitlistSubmissionInput {
  const { attribution } = submission;
  return {
    salutation: submission.salutation,
    firstName: submission.firstName,
    lastName: submission.lastName,
    email: submission.email,
    dateOfBirth: toIsoDate(submission.dateOfBirth),
    phoneE164: submission.phone.e164,
    phoneCountry: submission.phone.countryIso2,
    source: attribution.source ?? null,
    referrer: attribution.referrer ?? null,
    utmSource: attribution.utmSource ?? null,
    utmMedium: attribution.utmMedium ?? null,
    utmCampaign: attribution.utmCampaign ?? null,
    utmContent: attribution.utmContent ?? null,
    utmTerm: attribution.utmTerm ?? null,
    isSpam,

    termsText: TERMS_ACCEPTANCE.text,
    termsVersion: TERMS_ACCEPTANCE.version,
  };
}

export interface WaitlistJoinResult {
  outcome: WaitlistOutcome;
  reason?: string;
  entryId?: string;
  submittedAt?: string;
}

export async function joinWaitlist(
  client: WellPlaceClient,
  submission: WaitlistSubmission,
  isSpam = false,
): Promise<WaitlistJoinResult> {
  const termsVersion = await publishedLegalVersion(client);
  const result = await submitWaitlistEntry(client, { ...toRpcInput(submission, isSpam), termsVersion });

  switch (result.outcome) {
    case "created":
      return {
        outcome: "joined",
        entryId: result.entryId,
        submittedAt: result.submittedAt,
      };

    case "already_registered":
      return { outcome: "already_on_list" };

    case "failed":
      return { outcome: "failed", reason: result.message };
  }
}

export async function addWaitlistLeadManually(
  client: WellPlaceClient,
  input: ManualWaitlistEntryInput,
): Promise<
  | { outcome: "added"; entryId: string; submittedAt: string }
  | { outcome: "duplicate" }
  | { outcome: "failed"; reason: string }
> {
  const result = await createWaitlistEntryManual(client, input);

  if (result.outcome === "failed") {
    return { outcome: "failed", reason: result.message };
  }

  if (result.outcome === "already_registered") {
    return { outcome: "duplicate" };
  }

  return {
    outcome: "added",
    entryId: result.entryId,
    submittedAt: result.submittedAt,
  };
}

export function manualSubmissionForEmail(
  input: ManualWaitlistEntryInput,
): WaitlistSubmission {
  const [year, month, day] = input.dateOfBirth.split("-").map(Number);

  return {
    salutation: input.salutation,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    dateOfBirth: { day, month, year },
    phone: { e164: input.phoneE164, countryIso2: input.phoneCountry },
    attribution: {},

    termsAccepted: true,
  };
}
