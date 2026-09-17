import { INVOICE_COPY, INVOICE_MESSAGE_KEY } from "@/lib/config/invoice";
import type { TaxDocumentType } from "@/lib/db/invoice-record";
import {
  readAuthoredTemplate,
  queueGuestMessage,
  recordGuestMessageAttempt,
  type GuestMessageChannel,
} from "@/lib/db/payment-events";
import { findCreditNote, findInvoice } from "@/lib/db/queries/invoices";
import type { WellPlaceClient } from "@/lib/db/types";
import { renderCreditNotePdf } from "@/lib/documents/credit-note-pdf-view";
import { invoicePdfView } from "@/lib/documents/invoice-pdf-view";
import { renderTaxDocumentPdf, taxDocumentPdfFilename } from "@/lib/documents/tax-document-pdf";
import { emailAdapter } from "@/lib/messaging/mailer";
import { creditNoteEmail, invoiceDocument, invoiceEmail } from "@/lib/messaging/templates/invoice";
import type { EmailAdapter, EmailMessage, SendResult } from "@/lib/messaging/types";

export type TaxDocumentSendFailure = "not_found" | "voided" | "unavailable" | "not_sent" | "whatsapp_not_ready";

export type TaxDocumentSendReport =
  | {
      readonly sent: true;
      readonly messageId: string | null;
      readonly to: readonly string[];
      readonly notSent: readonly string[];
    }
  | { readonly sent: false; readonly reason: TaxDocumentSendFailure; readonly messageId: string | null };

export interface TaxDocumentSendRequest {
  readonly documentType: TaxDocumentType;
  readonly documentId: string;
  readonly channel: GuestMessageChannel;
  readonly recipients: readonly string[];
}

export interface TaxDocumentAdapters {
  readonly email?: EmailAdapter;
}

export type InvoiceEmailFailure = "not_found" | "voided" | "unavailable" | "not_sent";

export type InvoiceEmailReport =
  | { readonly sent: true; readonly messageId: string | null; readonly to: string }
  | { readonly sent: false; readonly reason: InvoiceEmailFailure; readonly messageId: string | null };

export interface InvoiceEmailOptions {
  readonly recipients?: readonly string[];
}

interface PreparedDocument {
  readonly number: string;
  readonly bookingId: string;
  readonly customerId: string;
  readonly firstName: string;
  readonly defaultEmail: string;
  readonly defaultPhone: string;
  readonly filename: string;
  readonly pdf: Buffer;
  readonly email: EmailMessage | null;
  readonly caption: string;
}

type Preparation = { readonly ok: true; readonly document: PreparedDocument } | { readonly ok: false; readonly reason: TaxDocumentSendFailure };

function defaultEmailAdapter(): EmailAdapter {
  return emailAdapter();
}

function failureText(result: SendResult): string | null {
  return result.ok ? null : `${result.reason}: ${result.message}`.slice(0, 2000);
}

async function safely(send: () => Promise<SendResult>): Promise<SendResult> {
  try {
    return await send();
  } catch (cause) {
    return { ok: false, reason: "provider_error", message: cause instanceof Error ? cause.message : "Unknown failure" };
  }
}

async function frameFor(client: WellPlaceClient, channel: GuestMessageChannel) {
  if (channel !== "email") return undefined;
  const template = await readAuthoredTemplate(client, INVOICE_MESSAGE_KEY);
  return template.outcome === "active"
    ? { footer: template.footer, footerDesign: template.footerDesign, headerDesign: template.headerDesign, branding: template.branding }
    : undefined;
}

async function prepare(client: WellPlaceClient, request: TaxDocumentSendRequest): Promise<Preparation> {
  const withEmail = request.channel === "email";

  if (request.documentType === "invoice") {
    const [lookup, frame] = await Promise.all([findInvoice(client, request.documentId), frameFor(client, request.channel)]);
    if (lookup.outcome === "not_found") return { ok: false, reason: "not_found" };
    if (lookup.outcome === "failed") return { ok: false, reason: "unavailable" };
    const invoice = lookup.invoice;
    if (invoice.voidedAt !== null) return { ok: false, reason: "voided" };

    const recipient = { email: invoice.billTo.email, firstName: invoice.billTo.firstName };
    return {
      ok: true,
      document: {
        number: invoice.invoiceNumber,
        bookingId: invoice.bookingId,
        customerId: invoice.customerId,
        firstName: invoice.billTo.firstName,
        defaultEmail: invoice.billTo.email,
        defaultPhone: invoice.billTo.phoneE164,
        filename: taxDocumentPdfFilename(invoice.invoiceNumber),
        pdf: await renderTaxDocumentPdf(invoicePdfView(invoice)),
        email: withEmail ? invoiceEmail(invoiceDocument(invoice), recipient, frame) : null,
        caption: INVOICE_COPY.whatsapp.invoiceCaption.replace("{number}", invoice.invoiceNumber),
      },
    };
  }

  const [lookup, frame] = await Promise.all([findCreditNote(client, request.documentId), frameFor(client, request.channel)]);
  if (lookup.outcome === "not_found") return { ok: false, reason: "not_found" };
  if (lookup.outcome === "failed") return { ok: false, reason: "unavailable" };
  const creditNote = lookup.creditNote;
  if (creditNote.voidedAt !== null || creditNote.state === "voided") return { ok: false, reason: "voided" };

  const recipient = { email: creditNote.billTo.email, firstName: creditNote.billTo.firstName };
  return {
    ok: true,
    document: {
      number: creditNote.creditNoteNumber,
      bookingId: creditNote.bookingId,
      customerId: creditNote.customerId,
      firstName: creditNote.billTo.firstName,
      defaultEmail: creditNote.billTo.email,
      defaultPhone: creditNote.billTo.phoneE164,
      filename: taxDocumentPdfFilename(creditNote.creditNoteNumber),
      pdf: await renderCreditNotePdf(creditNote),
      email: withEmail ? creditNoteEmail(creditNote, recipient, frame) : null,
      caption: INVOICE_COPY.whatsapp.creditNoteCaption.replace("{number}", creditNote.creditNoteNumber),
    },
  };
}

interface Delivery {
  readonly address: string;
  readonly messageId: string | null;
  readonly result: SendResult;
}

async function deliver(
  client: WellPlaceClient,
  document: PreparedDocument,
  channel: GuestMessageChannel,
  address: string,
  subject: string,
  body: string,
  send: () => Promise<SendResult>,
): Promise<Delivery> {
  const messageId = await queueGuestMessage(client, {
    templateKey: INVOICE_MESSAGE_KEY,
    bookingId: document.bookingId,
    customerId: document.customerId,
    toAddress: address,
    subject,
    body,
    channel,
  });
  const result = await safely(send);
  if (messageId !== null) {
    await recordGuestMessageAttempt(client, {
      messageId,
      sent: result.ok,
      providerMessageId: result.ok ? result.providerId || null : null,
      error: failureText(result),
      channel,
    });
  }
  if (!result.ok) {
    console.error(`[messages] ${INVOICE_MESSAGE_KEY} ${channel} not sent for ${document.number} (${result.reason}): ${result.message}`);
  }
  return { address, messageId, result };
}

export async function deliverTaxDocument(
  client: WellPlaceClient,
  request: TaxDocumentSendRequest,
  adapters: TaxDocumentAdapters = {},
): Promise<TaxDocumentSendReport> {
  // This project ships no WhatsApp connection, so the channel can never deliver.
  if (request.channel === "whatsapp") return { sent: false, reason: "whatsapp_not_ready", messageId: null };

  let prepared: Preparation;
  try {
    prepared = await prepare(client, request);
  } catch (cause) {
    console.error(
      `[messages] ${INVOICE_MESSAGE_KEY} could not be prepared for ${request.documentType} ${request.documentId}:`,
      cause instanceof Error ? cause.message : cause,
    );
    return { sent: false, reason: "not_sent", messageId: null };
  }
  if (!prepared.ok) return { sent: false, reason: prepared.reason, messageId: null };

  const document = prepared.document;
  const fallback = request.channel === "email" ? document.defaultEmail : document.defaultPhone;
  const recipients = request.recipients.length > 0 ? request.recipients : [fallback];

  try {
    const deliveries = await Promise.all(
      recipients.map((address) => {
        const email = document.email;
        if (email === null) throw new Error(`${document.number} has no email to send`);
        const adapter = adapters.email ?? defaultEmailAdapter();
        const message: EmailMessage = {
          ...email,
          to: address,
          attachments: [
            ...(email.attachments ?? []),
            { filename: document.filename, content: document.pdf.toString("base64") },
          ],
        };
        return deliver(client, document, "email", address, email.subject, email.text, () => adapter.send(message));
      }),
    );

    const messageId = deliveries.find((delivery) => delivery.messageId !== null)?.messageId ?? null;
    const to = deliveries.filter((delivery) => delivery.result.ok).map((delivery) => delivery.address);
    const notSent = deliveries.filter((delivery) => !delivery.result.ok).map((delivery) => delivery.address);

    if (to.length === 0) return { sent: false, reason: "not_sent", messageId };
    console.info(`[messages] ${INVOICE_MESSAGE_KEY} ${request.channel} accepted for ${document.number}`);
    return { sent: true, messageId, to, notSent };
  } catch (cause) {
    console.error(
      `[messages] ${INVOICE_MESSAGE_KEY} failed for ${document.number}:`,
      cause instanceof Error ? cause.message : cause,
    );
    return { sent: false, reason: "not_sent", messageId: null };
  }
}

export async function sendInvoiceEmail(
  invoiceId: string,
  client: WellPlaceClient,
  adapter: EmailAdapter = defaultEmailAdapter(),
  options: InvoiceEmailOptions = {},
): Promise<InvoiceEmailReport> {
  const report = await deliverTaxDocument(
    client,
    { documentType: "invoice", documentId: invoiceId, channel: "email", recipients: options.recipients ?? [] },
    { email: adapter },
  );
  if (report.sent) return { sent: true, messageId: report.messageId, to: report.to.join(", ") };
  return {
    sent: false,
    reason: report.reason === "whatsapp_not_ready" ? "not_sent" : report.reason,
    messageId: report.messageId,
  };
}
