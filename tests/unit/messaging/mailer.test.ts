import { describe, expect, it, vi } from "vitest";

import { createLogAdapter } from "@/lib/messaging/log-mailer";
import { resolveMailTransport } from "@/lib/messaging/mailer";
import { createSmtpAdapter, readSmtpSettings } from "@/lib/messaging/smtp";
import type { EmailMessage } from "@/lib/messaging/types";

const message: EmailMessage = {
  to: "staff@example.test",
  from: "WellPlace notifications <waitlist@wellplace.example>",
  subject: "New waitlist signup",
  text: "A new guest joined.",
  html: '<img src="cid:wellplace-wordmark" alt="WellPlace" />',
  kind: "transactional",
  attachments: [
    {
      filename: "wellplace-wordmark.png",
      path: "http://localhost:3000/brand/wordmark-dark-email.png",
      contentId: "wellplace-wordmark",
    },
    { filename: "invoice.pdf", content: Buffer.from("pdf-bytes").toString("base64") },
  ],
};

describe("[OUR CHOICE] which transport the demo mails through", () => {
  it("defaults to the log transport, so a fresh clone needs no mail credentials", () => {
    expect(resolveMailTransport({})).toBe("log");
    expect(resolveMailTransport({ MAIL_TRANSPORT: "" })).toBe("log");
    expect(resolveMailTransport({ MAIL_TRANSPORT: "anything-else" })).toBe("log");
  });

  it("switches to SMTP only when asked for it by name", () => {
    expect(resolveMailTransport({ MAIL_TRANSPORT: "smtp" })).toBe("smtp");
    expect(resolveMailTransport({ MAIL_TRANSPORT: " SMTP " })).toBe("smtp");
  });
});

describe("the log transport", () => {
  it("reports success and writes the message instead of sending it", async () => {
    const lines: string[] = [];
    const result = await createLogAdapter((line) => lines.push(line)).send(message);

    expect(result.ok).toBe(true);
    expect(lines.join("\n")).toContain("staff@example.test");
    expect(lines.join("\n")).toContain("New waitlist signup");
    expect(lines.join("\n")).toContain("not sent");
  });
});

describe("the SMTP transport", () => {
  it("reads settings only when host, user and password are all present", () => {
    expect(readSmtpSettings({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "a@b.test" })).toBeNull();
    expect(
      readSmtpSettings({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "a@b.test", SMTP_PASSWORD: "x" }),
    ).toMatchObject({ host: "smtp.gmail.com", port: 587 });
  });

  it("falls back to port 587 when SMTP_PORT is absent or unusable", () => {
    const base = { SMTP_HOST: "smtp.gmail.com", SMTP_USER: "a@b.test", SMTP_PASSWORD: "x" };
    expect(readSmtpSettings({ ...base, SMTP_PORT: "not-a-port" })?.port).toBe(587);
    expect(readSmtpSettings({ ...base, SMTP_PORT: "465" })?.port).toBe(465);
  });

  it("refuses to send, rather than throwing, when it is not configured", async () => {
    const result = await createSmtpAdapter(null).send({ ...message, from: undefined });

    expect(result).toMatchObject({ ok: false, reason: "not_configured" });
  });

  it("passes inline and file attachments through in nodemailer's shape", async () => {
    const seen: Record<string, unknown>[] = [];
    const sendMail = vi.fn(async (options: Record<string, unknown>) => {
      seen.push(options);
      return { messageId: "<abc@local>", rejected: [] as string[] };
    });
    const adapter = createSmtpAdapter(
      { host: "smtp.gmail.com", port: 587, user: "a@b.test", pass: "x", from: undefined },
      { sendMail } as never,
    );

    const result = await adapter.send(message);

    expect(result).toEqual({ ok: true, providerId: "<abc@local>" });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const sent = seen[0] as unknown as {
      attachments: readonly Record<string, unknown>[];
      headers?: Record<string, string>;
    };
    expect(sent.attachments[0]).toMatchObject({
      filename: "wellplace-wordmark.png",
      cid: "wellplace-wordmark",
    });
    expect(sent.attachments[1]?.content).toBeInstanceOf(Buffer);
  });

  it("reports rejected recipients as a rejection rather than a success", async () => {
    const sendMail = vi.fn(async (options: Record<string, unknown>) => {
      void options;
      return { messageId: "<abc@local>", rejected: ["nope@example.test"] };
    });
    const adapter = createSmtpAdapter(
      { host: "smtp.gmail.com", port: 587, user: "a@b.test", pass: "x", from: undefined },
      { sendMail } as never,
    );

    expect(await adapter.send(message)).toMatchObject({ ok: false, reason: "rejected" });
  });
});
