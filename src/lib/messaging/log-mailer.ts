import type { EmailAdapter, EmailMessage, SendResult } from "@/lib/messaging/types";

/**
 * The zero-configuration transport the demo runs on. Nothing leaves the
 * machine: every message is written to the server log so the whole booking,
 * invoice and waitlist flow can be exercised end to end with no mail account,
 * no API key and no verified domain.
 */
export function createLogAdapter(write: (line: string) => void = console.info): EmailAdapter {
  return {
    name: "log",

    async send(message: EmailMessage): Promise<SendResult> {
      const recipients = Array.isArray(message.to) ? message.to.join(", ") : message.to;
      const attachments = message.attachments?.map((one) => one.filename) ?? [];

      write(
        [
          "",
          "──────── email (demo log transport — not sent) ────────",
          `to        ${recipients}`,
          `from      ${message.from ?? "(default sender)"}`,
          `subject   ${message.subject}`,
          `kind      ${message.kind}`,
          ...(message.replyTo ? [`reply-to  ${message.replyTo}`] : []),
          ...(message.reference ? [`reference ${message.reference}`] : []),
          ...(attachments.length ? [`files     ${attachments.join(", ")}`] : []),
          "",
          message.text,
          "───────────────────────────────────────────────────────",
          "",
        ].join("\n"),
      );

      return { ok: true, providerId: `log-${Date.now().toString(36)}` };
    },
  };
}
