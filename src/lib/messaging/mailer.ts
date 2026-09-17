import { createLogAdapter } from "@/lib/messaging/log-mailer";
import { createSmtpAdapter, readSmtpSettings, type EnvLike } from "@/lib/messaging/smtp";
import type { EmailAdapter } from "@/lib/messaging/types";

export const MAIL_TRANSPORTS = ["log", "smtp"] as const;
export type MailTransport = (typeof MAIL_TRANSPORTS)[number];

export function resolveMailTransport(env: EnvLike): MailTransport {
  const configured = env.MAIL_TRANSPORT?.trim().toLowerCase();
  return configured === "smtp" ? "smtp" : "log";
}

/**
 * One place decides how mail leaves the application. `log` is the default so a
 * fresh clone runs with no credentials at all; `smtp` sends through any free
 * SMTP account once SMTP_HOST, SMTP_USER and SMTP_PASSWORD are set.
 */
export function emailAdapter(env: EnvLike = process.env): EmailAdapter {
  return resolveMailTransport(env) === "smtp"
    ? createSmtpAdapter(readSmtpSettings(env))
    : createLogAdapter();
}
