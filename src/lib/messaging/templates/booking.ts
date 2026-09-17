import type { EmailFooterDesign } from "@/lib/domain/email/footer";
import type { EmailHeaderDesign } from "@/lib/domain/email/header";
import { footerFor } from "@/lib/config/message-email-frame";
import { formatAed } from "@/components/shared/money";
import { emailConfig, formatSender } from "@/lib/config/email";
import { BOOKING_MESSAGE_COPY, type BookingMessageKey } from "@/lib/config/booking-messages";
import { formatDubaiDateTime, formatDubaiTime } from "@/lib/domain/time";
import { renderEmail, type EmailBlock } from "@/lib/messaging/templates/layout";
import type { EmailMessage } from "@/lib/messaging/types";

export interface BookingMessageContext {
  readonly reference: string;
  readonly email: string;
  readonly firstName: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly adults: number;
  readonly children: number;
  readonly amountFils: number;
  readonly taxFils: number;
  readonly taxLabel: string | null;
  readonly simulated: boolean;
  readonly holdExpiresAt: string | null;
  readonly refundFils: number;
  readonly attachmentNote?: string | null;
}

export interface AuthoredWording {
  readonly subject: string | null;
  readonly body: string;
}

function party(context: BookingMessageContext): string {
  const adults = `${context.adults} ${context.adults === 1 ? "adult" : "adults"}`;
  if (context.children === 0) return adults;
  return `${adults}, ${context.children} ${context.children === 1 ? "child" : "children"}`;
}

function visitRows(context: BookingMessageContext) {
  return [
    { label: "Booking reference", value: context.reference },
    { label: "Visit", value: `${formatDubaiDateTime(context.startsAt)} to ${formatDubaiTime(context.endsAt)}` },
    { label: "Guests", value: party(context) },
  ];
}

function paragraphs(body: string): EmailBlock[] {
  return body
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text) => ({ kind: "paragraph", text }));
}

function factBlocks(key: BookingMessageKey, context: BookingMessageContext, receiptUrl: string | null): EmailBlock[] {
  const copy = BOOKING_MESSAGE_COPY[key];
  const tax = context.taxLabel ?? "VAT";
  const blocks: EmailBlock[] = [];

  if (key === "booking_confirmation") {
    blocks.push({
      kind: "panel",
      rows: [
        ...visitRows(context),
        { label: "Paid", value: formatAed(context.amountFils) },
        { label: `Includes ${tax}`, value: formatAed(context.taxFils) },
      ],
    });
  } else if (key === "payment_failed") {
    blocks.push({ kind: "panel", rows: visitRows(context) });
    if (context.holdExpiresAt !== null && Date.parse(context.holdExpiresAt) > Date.now()) {
      blocks.push({ kind: "paragraph", text: copy.holdLine.replace("{time}", formatDubaiTime(context.holdExpiresAt)) });
    }
  } else {
    blocks.push({
      kind: "panel",
      rows: [
        { label: "Booking reference", value: context.reference },
        { label: "Refund", value: formatAed(context.refundFils) },
      ],
    });
  }

  if (context.attachmentNote) blocks.push({ kind: "paragraph", text: context.attachmentNote });
  if (receiptUrl !== null) blocks.push({ kind: "button", label: copy.buttonLabel, href: receiptUrl });
  if (context.simulated) blocks.push({ kind: "note", text: BOOKING_MESSAGE_COPY.simulationNote });
  return blocks;
}

export function bookingMessageEmail(
  key: BookingMessageKey,
  context: BookingMessageContext,
  authored: AuthoredWording | null,
  receiptUrl: string | null,
  frame?: { footer?: string | null; footerDesign?: EmailFooterDesign | null; headerDesign?: EmailHeaderDesign | null; branding?: boolean },
): EmailMessage {
  const config = emailConfig();
  const copy = BOOKING_MESSAGE_COPY[key];
  const subject = `${authored?.subject?.trim() || copy.subject} — ${context.reference}`;
  const opening: EmailBlock[] = authored !== null && authored.body.trim() !== ""
    ? paragraphs(authored.body)
    : [{ kind: "lead", text: copy.lead }];

  const { html, text, attachments } = renderEmail({
    subject,
    preheader: copy.preheader,
    assetBaseUrl: config.assetBaseUrl,
    footerDesign: frame?.footerDesign ?? undefined,
    headerDesign: frame?.headerDesign ?? undefined,
    footerLines: frame?.footer != null ? footerFor(key, frame.footer) : BOOKING_MESSAGE_COPY.footer,
    branding: frame?.branding,
    blocks: [
      { kind: "eyebrow", text: copy.eyebrow },
      { kind: "heading", text: copy.heading.replace("{name}", context.firstName) },
      ...opening,
      ...factBlocks(key, context, receiptUrl),
    ],
  });

  return {
    to: context.email,
    from: formatSender(config.guestFromName, config.guestFrom),
    replyTo: config.guestFrom,
    subject,
    text,
    html,
    attachments,
    kind: "transactional",
    reference: `${key}-${context.reference}`,
  };
}
