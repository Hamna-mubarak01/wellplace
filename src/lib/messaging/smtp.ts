import nodemailer, { type Transporter } from "nodemailer";

import type { EmailAdapter, EmailMessage, SendResult } from "@/lib/messaging/types";

export type EnvLike = Readonly<Record<string, string | undefined>>;

export interface SmtpSettings {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly pass: string;
  readonly from: string | undefined;
}

// Any SMTP server works. The demo is written against a free Gmail account with
// an App Password (Google Account → Security → 2-Step Verification → App
// passwords), which costs nothing and needs no verified sending domain.
export function readSmtpSettings(env: EnvLike): SmtpSettings | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  // Gmail displays app passwords in groups of four; the spaces are not part of it.
  const pass = env.SMTP_PASSWORD?.replace(/\s+/g, "");
  if (!host || !user || !pass) return null;

  const port = Number(env.SMTP_PORT?.trim() || "587");
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    user,
    pass,
    from: env.SMTP_FROM?.trim() || undefined,
  };
}

function attachmentsFor(message: EmailMessage) {
  return message.attachments?.map((attachment) =>
    "content" in attachment
      ? {
          filename: attachment.filename,
          content: Buffer.from(attachment.content, "base64"),
        }
      : {
          filename: attachment.filename,
          path: attachment.path,
          cid: attachment.contentId,
        },
  );
}

export function createSmtpAdapter(
  settings: SmtpSettings | null,
  transporter?: Transporter,
): EmailAdapter {
  return {
    name: "smtp",

    async send(message: EmailMessage): Promise<SendResult> {
      // SMTP_FROM wins over the sender the template asked for. A free mailbox
      // (Gmail and friends) only accepts mail from the account that
      // authenticated, so sending as hello@… through a personal account is
      // rejected or silently rewritten. The intended sender is not lost: it
      // becomes the Reply-To, so a guest's reply still reaches the right place.
      const sender = settings?.from ?? message.from;
      const replyTo =
        message.replyTo ?? (message.from && message.from !== sender ? message.from : undefined);

      if (!settings || !sender) {
        return {
          ok: false,
          reason: "not_configured",
          message:
            "SMTP_HOST, SMTP_USER and SMTP_PASSWORD must be set, and the message carries no " +
            "sender and no default is configured. The message was not sent and was not queued.",
        };
      }

      try {
        const transport =
          transporter ??
          nodemailer.createTransport({
            host: settings.host,
            port: settings.port,
            // 465 is implicit TLS; 587 upgrades with STARTTLS.
            secure: settings.port === 465,
            auth: { user: settings.user, pass: settings.pass },
          });

        const sent = (await transport.sendMail({
          from: sender,
          to: Array.isArray(message.to) ? message.to.slice() : (message.to as string),
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(replyTo ? { replyTo } : {}),
          ...(message.attachments?.length ? { attachments: attachmentsFor(message) } : {}),
          ...(message.reference ? { headers: { "X-Entity-Ref-ID": message.reference } } : {}),
        })) as { messageId?: string; rejected?: readonly unknown[] };

        const rejected = sent.rejected ?? [];
        if (rejected.length > 0) {
          return {
            ok: false,
            reason: "rejected",
            message: `The server rejected ${rejected.length} recipient(s): ${rejected
              .map(String)
              .join(", ")
              .slice(0, 200)}`,
          };
        }

        return { ok: true, providerId: sent.messageId ?? "" };
      } catch (cause) {
        return {
          ok: false,
          reason: "provider_error",
          message: cause instanceof Error ? cause.message : "Unknown transport failure",
        };
      }
    },
  };
}
