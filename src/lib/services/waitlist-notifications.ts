import { emailConfig } from "@/lib/config/email";
import { emailAdapter } from "@/lib/messaging/mailer";
import type { EmailAdapter, EmailMessage, SendResult } from "@/lib/messaging/types";
import { calculateAge } from "@/lib/domain/age";
import { formatDubaiDateTime, todayInDubai } from "@/lib/domain/time";
import { authoredMessage } from "@/lib/services/message-document-service";
import type { WaitlistSubmission } from "@/lib/validation/waitlist";

export interface WaitlistNotificationInput {
  submission: WaitlistSubmission;
  submittedAt: string;
  reference?: string;
}

export interface WaitlistNotificationReport {
  guest: SendResult;
  operations: SendResult;
}

const SALUTATION_LABEL: Readonly<Record<"mr" | "ms", string>> = {
  mr: "Mr",
  ms: "Ms",
};

function defaultAdapter(): EmailAdapter {
  return emailAdapter();
}

const NOT_SENT: SendResult = {
  ok: false,
  reason: "not_configured",
  message: "This message is switched off in Message templates.",
};

async function sendSafely(
  adapter: EmailAdapter,
  message: EmailMessage | null,
  reference: string | undefined,
): Promise<SendResult> {
  if (message === null) return NOT_SENT;

  try {
    return await adapter.send(reference ? { ...message, reference } : message);
  } catch (cause) {
    return {
      ok: false,
      reason: "provider_error",
      message: cause instanceof Error ? cause.message : "Unknown failure",
    };
  }
}

export async function sendWaitlistEmails(
  { submission, submittedAt, reference }: WaitlistNotificationInput,
  adapter: EmailAdapter = defaultAdapter(),
): Promise<WaitlistNotificationReport> {
  const { attribution } = submission;
  const fullName =
    `${SALUTATION_LABEL[submission.salutation]} ${submission.firstName} ${submission.lastName}`.trim();

  const { day, month, year } = submission.dateOfBirth;
  const customerValues = {
    salutation: SALUTATION_LABEL[submission.salutation],
    first_name: submission.firstName,
    last_name: submission.lastName,
    full_name: fullName,
    email: submission.email,
    phone: submission.phone.e164,
    phone_country: submission.phone.countryIso2,
    date_of_birth: new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day))),
    age: String(calculateAge(submission.dateOfBirth,
      new Date(`${todayInDubai(new Date(submittedAt))}T00:00:00Z`))),
    joined_at: formatDubaiDateTime(submittedAt),
  };

  const [guestMessage, operationsMessage] = await Promise.all([
    authoredMessage(
      "waitlist_confirmation",
      customerValues,
      { to: submission.email },
    ),
    authoredMessage("waitlist_signup_notification", {
      ...customerValues,
      source: attribution.source ?? "",
      campaign: attribution.utmCampaign ?? "",
      utm_source: attribution.utmSource ?? "",
      utm_medium: attribution.utmMedium ?? "",
      utm_content: attribution.utmContent ?? "",
      utm_term: attribution.utmTerm ?? "",
      referrer: attribution.referrer ?? "",
      console_url: emailConfig().consoleUrl,
    }),
  ]);

  const [guest, operations] = await Promise.all([
    sendSafely(adapter, guestMessage, reference ? `waitlist-guest-${reference}` : undefined),
    sendSafely(adapter, operationsMessage, reference ? `waitlist-ops-${reference}` : undefined),
  ]);

  for (const [label, result] of [["guest", guest], ["operations", operations]] as const) {
    if (result.ok) {
      console.info(`[waitlist] ${label} email accepted by provider: ${result.providerId}`);
    } else {
      console.error(
        `[waitlist] ${label} email not sent (${result.reason}): ${result.message}`,
      );
    }
  }

  return { guest, operations };
}
