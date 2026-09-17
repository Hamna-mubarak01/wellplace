import { emailAdapter } from "@/lib/messaging/mailer";
import type { EmailAdapter, EmailMessage, SendResult } from "@/lib/messaging/types";
import { authoredMessage } from "@/lib/services/message-document-service";
import type { ContactSubmission } from "@/lib/validation/contact";

export interface ContactNotificationReport {
  operations: SendResult;
  guest: SendResult;
}

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
): Promise<SendResult> {
  if (message === null) return NOT_SENT;

  try {
    return await adapter.send(message);
  } catch (cause) {
    return {
      ok: false,
      reason: "provider_error",
      message: cause instanceof Error ? cause.message : "Unknown failure",
    };
  }
}

export async function sendContactEmails(
  submission: ContactSubmission,
  adapter: EmailAdapter = defaultAdapter(),
): Promise<ContactNotificationReport> {
  const fullName = `${submission.firstName} ${submission.lastName}`.trim();

  const customerValues = {
    first_name: submission.firstName,
    last_name: submission.lastName,
    full_name: fullName,
    email: submission.email,
    phone: submission.phone.e164,
    phone_country: submission.phone.e164 ? submission.phone.countryIso2 : "",
    message: submission.message,
  };

  const [operationsMessage, guestMessage] = await Promise.all([
    authoredMessage("contact_notification", customerValues),
    authoredMessage("contact_acknowledgement", customerValues, { to: submission.email }),
  ]);

  const [operations, guest] = await Promise.all([
    sendSafely(adapter, operationsMessage),
    sendSafely(adapter, guestMessage),
  ]);

  for (const [label, result] of [
    ["operations", operations],
    ["guest", guest],
  ] as const) {
    if (result.ok) {
      console.info(`[contact] ${label} email accepted by provider: ${result.providerId}`);
    } else {
      console.error(`[contact] ${label} email not sent (${result.reason}): ${result.message}`);
    }
  }

  return { operations, guest };
}

export async function sendContactNotification(
  submission: ContactSubmission,
  adapter: EmailAdapter = defaultAdapter(),
): Promise<SendResult> {
  const { operations } = await sendContactEmails(submission, adapter);
  return operations;
}
