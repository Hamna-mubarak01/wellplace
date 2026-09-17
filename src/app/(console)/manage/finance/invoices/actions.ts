"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import {
  billToCorrection,
  regenerateInvoiceSchema,
  sendTaxDocumentSchema,
} from "@/app/(console)/manage/finance/invoices/invoice-inputs";
import { requireManagement } from "@/lib/auth/session";
import { FINANCE_PATH, creditNotePath, invoicePath, managedBookingPath } from "@/lib/config/finance";
import { INVOICE_COPY } from "@/lib/config/invoice";
import type { TaxDocumentType } from "@/lib/db/invoice-record";
import {
  MANAGEMENT_INVOICE_HAS_CREDIT_NOTES,
  MANAGEMENT_INVOICE_SETTINGS_INCOMPLETE,
  issueInvoice,
  regenerateInvoice,
  voidInvoice,
} from "@/lib/db/rpc";
import { createClient } from "@/lib/db/server";
import { ACTION_UNCONFIRMED } from "@/lib/domain/action-errors";
import { deliverTaxDocument, type TaxDocumentSendFailure } from "@/lib/services/invoice-notifications";
import { reasonSchema } from "@/lib/validation/audit-reason";
import { idSchema } from "@/lib/validation/console-inputs";

export interface IssuedInvoiceLink {
  readonly id: string;
  readonly number: string;
}

export type IssueInvoiceResult =
  | { ok: true; invoice: IssuedInvoiceLink }
  | { ok: false; reason: "settings_incomplete" | "refused" | "failed"; message: string };

export type InvoiceActionResult = { ok: true } | { ok: false; message: string; hasCreditNotes?: boolean };

export type SendTaxDocumentResult =
  | { ok: true; to: readonly string[]; notSent: readonly string[] }
  | { ok: false; message: string };

const COPY = INVOICE_COPY.console;

const issueSchema = z.object({ bookingId: idSchema });
const voidSchema = z.object({ invoiceId: idSchema, reason: reasonSchema });

function sendFailureMessage(
  reason: TaxDocumentSendFailure,
  documentType: TaxDocumentType,
  channel: "email" | "whatsapp",
): string {
  switch (reason) {
    case "whatsapp_not_ready":
      return COPY.whatsappNotReady;
    case "not_found":
      return documentType === "invoice" ? COPY.emailNotFound : COPY.creditNoteNotFound;
    case "voided":
      return documentType === "invoice" ? COPY.emailVoided : COPY.creditNoteVoided;
    case "unavailable":
      return COPY.emailUnavailable;
    case "not_sent":
      return channel === "email" ? COPY.emailNotSent : COPY.whatsappNotSent;
  }
}

function refreshInvoiceSurfaces(bookingId: string | null, ...paths: string[]): void {
  revalidatePath(FINANCE_PATH.invoices, "layout");
  for (const path of paths) revalidatePath(path);
  if (bookingId !== null) revalidatePath(managedBookingPath(bookingId));
  else revalidatePath("/manage/bookings", "layout");
  revalidatePath("/manage/customers", "layout");
}

function issueRefusal(code: string): "settings_incomplete" | "refused" {
  return code === MANAGEMENT_INVOICE_SETTINGS_INCOMPLETE ? "settings_incomplete" : "refused";
}

export async function issueBookingInvoice(input: unknown): Promise<IssueInvoiceResult> {
  await requireManagement();
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "refused", message: parsed.error.issues[0].message };

  try {
    const result = await issueInvoice(await createClient(), parsed.data.bookingId);
    switch (result.outcome) {
      case "ok":
        refreshInvoiceSurfaces(result.value.bookingId, invoicePath(result.value.id));
        return { ok: true, invoice: { id: result.value.id, number: result.value.invoiceNumber } };
      case "refused":
        return { ok: false, reason: issueRefusal(result.code), message: result.message };
      case "failed":
        return { ok: false, reason: "failed", message: result.message };
      case "no_suite":
        return { ok: false, reason: "failed", message: ACTION_UNCONFIRMED };
    }
  } catch (cause) {
    console.error("[finance] issuing an invoice failed:", cause instanceof Error ? cause.message : cause);
    return { ok: false, reason: "failed", message: ACTION_UNCONFIRMED };
  }
}

export async function regenerateTaxInvoice(input: unknown): Promise<IssueInvoiceResult> {
  await requireManagement();
  const parsed = regenerateInvoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "refused", message: parsed.error.issues[0].message };

  try {
    const result = await regenerateInvoice(await createClient(), {
      invoiceId: parsed.data.invoiceId,
      reason: parsed.data.reason,
      billTo: billToCorrection(parsed.data.billTo),
    });
    switch (result.outcome) {
      case "ok":
        refreshInvoiceSurfaces(result.value.bookingId, invoicePath(parsed.data.invoiceId), invoicePath(result.value.id));
        return { ok: true, invoice: { id: result.value.id, number: result.value.invoiceNumber } };
      case "refused":
        return { ok: false, reason: issueRefusal(result.code), message: result.message };
      case "failed":
        return { ok: false, reason: "failed", message: result.message };
      case "no_suite":
        return { ok: false, reason: "failed", message: ACTION_UNCONFIRMED };
    }
  } catch (cause) {
    console.error("[finance] regenerating an invoice failed:", cause instanceof Error ? cause.message : cause);
    return { ok: false, reason: "failed", message: ACTION_UNCONFIRMED };
  }
}

export async function voidIssuedInvoice(input: unknown): Promise<InvoiceActionResult> {
  await requireManagement();
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  try {
    const result = await voidInvoice(await createClient(), parsed.data);
    if (result.outcome === "ok") {
      refreshInvoiceSurfaces(result.value.bookingId, invoicePath(result.value.id));
      return { ok: true };
    }
    if (result.outcome === "refused" && result.code === MANAGEMENT_INVOICE_HAS_CREDIT_NOTES) {
      return { ok: false, message: COPY.hasCreditNotes, hasCreditNotes: true };
    }
    return { ok: false, message: result.outcome === "no_suite" ? ACTION_UNCONFIRMED : result.message };
  } catch (cause) {
    console.error("[finance] voiding an invoice failed:", cause instanceof Error ? cause.message : cause);
    return { ok: false, message: ACTION_UNCONFIRMED };
  }
}

export async function sendTaxDocument(input: unknown): Promise<SendTaxDocumentResult> {
  await requireManagement();
  const parsed = sendTaxDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { documentType, documentId, channel, recipients } = parsed.data;

  try {
    const report = await deliverTaxDocument(await createClient(), { documentType, documentId, channel, recipients });
    refreshInvoiceSurfaces(null, documentType === "invoice" ? invoicePath(documentId) : creditNotePath(documentId));
    if (report.sent) return { ok: true, to: report.to, notSent: report.notSent };
    return { ok: false, message: sendFailureMessage(report.reason, documentType, channel) };
  } catch (cause) {
    console.error("[finance] sending a tax document failed:", cause instanceof Error ? cause.message : cause);
    return { ok: false, message: channel === "email" ? COPY.emailNotSent : COPY.whatsappNotSent };
  }
}
