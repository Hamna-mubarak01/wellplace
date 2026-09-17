import {
  RECOVERY_REFUND_LEAD,
  TAX_DOCUMENT_ATTACHMENT_NOTE,
  type BookingMessageKey,
} from "@/lib/config/booking-messages";
import { RECEIPT_LINK, receiptSchema } from "@/lib/config/receipt";
import { SITE_URL } from "@/lib/config/seo";
import { guestDocument, guestReceipt } from "@/lib/db/guest-checkout";
import type { GuestTaxDocument } from "@/lib/db/invoice-record";
import {
  queueGuestMessage,
  readAuthoredTemplate,
  readPaymentMessageContext,
  recordGuestMessageAttempt,
  type PaymentMessageContext,
} from "@/lib/db/payment-events";
import type { WellPlaceClient } from "@/lib/db/types";
import { renderGuestDocumentPdf } from "@/lib/documents/guest-document-pdf";
import { emailAdapter } from "@/lib/messaging/mailer";
import { bookingMessageEmail, type AuthoredWording } from "@/lib/messaging/templates/booking";
import type { EmailAdapter, EmailMessage, FileEmailAttachment, SendResult } from "@/lib/messaging/types";

export type BookingMessageReport =
  | { readonly sent: true; readonly messageId: string | null }
  | { readonly sent: false; readonly reason: "no_context" | "inactive" | "not_sent"; readonly messageId: string | null };

export interface BookingMessageOptions {
  readonly refundFils?: number;
  readonly recovery?: boolean;
}

interface TaxDocumentAttachment {
  readonly note: string;
  readonly attachment: FileEmailAttachment;
}

const receiptDocumentsSchema = receiptSchema.pick({ documents: true, refunds: true });

function defaultAdapter(): EmailAdapter {
  return emailAdapter();
}

async function sendSafely(adapter: EmailAdapter, build: () => EmailMessage): Promise<SendResult> {
  try {
    return await adapter.send(build());
  } catch (cause) {
    return { ok: false, reason: "provider_error", message: cause instanceof Error ? cause.message : "Unknown failure" };
  }
}

function origin(): string {
  return SITE_URL.replace(/\/+$/, "");
}

function actionUrl(key: BookingMessageKey, context: PaymentMessageContext): string | null {
  if (key === "payment_failed") return `${origin()}/book`;
  return context.receiptToken === null ? null : `${origin()}${RECEIPT_LINK.path}/${context.receiptToken}`;
}

async function documentToAttach(
  key: BookingMessageKey,
  context: PaymentMessageContext,
  token: string,
  refundFils: number,
): Promise<GuestTaxDocument | null> {
  const raw = await guestReceipt(token);
  if (raw === null) return null;
  const { documents, refunds } = receiptDocumentsSchema.parse(raw);
  const newestFirst = [...documents].reverse();

  if (key === "booking_confirmation") {
    const summary = newestFirst.find((document) => document.type === "invoice");
    if (summary === undefined) return null;
    const document = await guestDocument(token, summary.id);
    const coversPayment =
      document?.type === "invoice" &&
      (document.invoice.payments ?? []).some((payment) => payment.paymentId === context.paymentId);
    return coversPayment ? document : null;
  }

  const refund = [...refunds].reverse().find((item) => !item.pending && item.amountFils === refundFils);
  if (refund === undefined) return null;
  const summary = newestFirst.find(
    (document) =>
      document.type === "credit_note" &&
      document.totalFils === refundFils &&
      Date.parse(document.issuedAt) >= Date.parse(refund.requestedAt),
  );
  if (summary === undefined) return null;
  const document = await guestDocument(token, summary.id);
  return document?.type === "credit_note" && document.creditNote.refundId === refund.id ? document : null;
}

async function taxDocumentAttachment(
  key: BookingMessageKey,
  context: PaymentMessageContext,
  options: BookingMessageOptions,
  refundFils: number,
): Promise<TaxDocumentAttachment | null> {
  if (key === "payment_failed" || options.recovery === true || context.receiptToken === null) return null;
  try {
    const document = await documentToAttach(key, context, context.receiptToken, refundFils);
    if (document === null) return null;
    const rendered = await renderGuestDocumentPdf(document);
    return {
      note: TAX_DOCUMENT_ATTACHMENT_NOTE[document.type].replace("{number}", rendered.number),
      attachment: { filename: rendered.filename, content: rendered.pdf.toString("base64") },
    };
  } catch (cause) {
    console.error(
      `[messages] ${key} for ${context.reference} is sent without its tax document:`,
      cause instanceof Error ? cause.message : cause,
    );
    return null;
  }
}

export async function sendBookingMessage(
  key: BookingMessageKey,
  paymentId: string,
  client: WellPlaceClient,
  options: BookingMessageOptions = {},
  adapter: EmailAdapter = defaultAdapter(),
): Promise<BookingMessageReport> {
  try {
    const context = await readPaymentMessageContext(client, paymentId);
    if (context === null) return { sent: false, reason: "no_context", messageId: null };

    const template = await readAuthoredTemplate(client, key);
    if (template.outcome === "inactive") return { sent: false, reason: "inactive", messageId: null };

    const authored: AuthoredWording | null =
      template.outcome === "active" && template.body !== null
        ? { subject: template.subject, body: template.body }
        : options.recovery === true
          ? { subject: null, body: RECOVERY_REFUND_LEAD }
          : null;

    const refundFils = options.refundFils ?? (context.refundPendingFils + context.refundSettledFils);
    const taxDocument = await taxDocumentAttachment(key, context, options, refundFils);
    const build = () =>
      bookingMessageEmail(
        key,
        {
          reference: context.reference,
          email: context.email,
          firstName: context.firstName,
          startsAt: context.startsAt,
          endsAt: context.endsAt,
          adults: context.adults,
          children: context.children,
          amountFils: context.amountFils,
          taxFils: context.taxFils,
          taxLabel: context.taxLabel,
          simulated: context.simulated,
          holdExpiresAt: context.holdExpiresAt,
          refundFils,
          attachmentNote: taxDocument?.note ?? null,
        },
        authored,
        actionUrl(key, context),
        template.outcome === "active" ? { footer: template.footer, footerDesign: template.footerDesign, headerDesign: template.headerDesign, branding: template.branding } : undefined,
      );

    let prepared: EmailMessage;
    try {
      const built = build();
      prepared =
        taxDocument === null
          ? built
          : { ...built, attachments: [...(built.attachments ?? []), taxDocument.attachment] };
    } catch (cause) {
      console.error(`[messages] ${key} could not be rendered for ${context.reference}:`, cause instanceof Error ? cause.message : cause);
      return { sent: false, reason: "not_sent", messageId: null };
    }

    const messageId = await queueGuestMessage(client, {
      templateKey: key,
      bookingId: context.bookingId,
      customerId: context.customerId,
      toAddress: context.email,
      subject: prepared.subject,
      body: prepared.text,
    });

    const result = await sendSafely(adapter, () => prepared);
    if (messageId !== null) {
      await recordGuestMessageAttempt(client, {
        messageId,
        sent: result.ok,
        providerMessageId: result.ok ? result.providerId ?? null : null,
        error: result.ok ? null : `${result.reason}: ${result.message}`.slice(0, 2000),
      });
    }

    if (!result.ok) {
      console.error(`[messages] ${key} not sent for ${context.reference} (${result.reason}): ${result.message}`);
      return { sent: false, reason: "not_sent", messageId };
    }
    console.info(`[messages] ${key} accepted by provider for ${context.reference}`);
    return { sent: true, messageId };
  } catch (cause) {
    console.error(`[messages] ${key} failed for payment ${paymentId}:`, cause instanceof Error ? cause.message : cause);
    return { sent: false, reason: "not_sent", messageId: null };
  }
}
