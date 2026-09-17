import { z } from "zod";

import {
  CUSTOMER_TRN_PATTERN,
  CUSTOMER_TRN_SEPARATORS,
  INVOICE_BILL_TO_LIMITS,
  INVOICE_COPY,
  INVOICE_SEND,
} from "@/lib/config/invoice";
import { TAX_DOCUMENT_TYPES } from "@/lib/db/invoice-record";
import { reasonSchema } from "@/lib/validation/audit-reason";
import { idSchema } from "@/lib/validation/console-inputs";

export const SEND_CHANNELS = ["email"] as const;
export type SendChannel = (typeof SEND_CHANNELS)[number];

const COPY = INVOICE_COPY.console;

export const emailRecipientSchema = z.string().trim().pipe(z.email(COPY.invalidEmail));

function recipientList(item: z.ZodType<string>) {
  return z
    .array(item)
    .min(1, COPY.noRecipients)
    .max(INVOICE_SEND.maxRecipients, COPY.tooManyRecipients.replace("{max}", String(INVOICE_SEND.maxRecipients)))
    .refine(
      (recipients) => new Set(recipients.map((recipient) => recipient.toLowerCase())).size === recipients.length,
      COPY.duplicateRecipient,
    );
}

const documentFields = {
  documentType: z.enum(TAX_DOCUMENT_TYPES),
  documentId: idSchema,
};

// Email is the only delivery channel this project ships.
export const sendTaxDocumentSchema = z.object({
  ...documentFields,
  channel: z.literal("email"),
  recipients: recipientList(emailRecipientSchema),
});

export type SendTaxDocumentInput = z.infer<typeof sendTaxDocumentSchema>;

function limited(max: number, noun: string) {
  return z.string().trim().max(max, `Keep the ${noun} to ${max} characters or fewer.`);
}

export const regenerateInvoiceSchema = z.object({
  invoiceId: idSchema,
  reason: reasonSchema,
  billTo: z.object({
    name: limited(INVOICE_BILL_TO_LIMITS.name, "name").min(1, COPY.nameRequired),
    company: limited(INVOICE_BILL_TO_LIMITS.company, "company name"),
    trn: z
      .string()
      .transform((value) => value.replace(CUSTOMER_TRN_SEPARATORS, ""))
      .refine((value) => value === "" || CUSTOMER_TRN_PATTERN.test(value), COPY.trnInvalid),
    address: limited(INVOICE_BILL_TO_LIMITS.address, "address"),
  }),
});

export type RegenerateInvoiceInput = z.infer<typeof regenerateInvoiceSchema>;

export function billToCorrection(billTo: RegenerateInvoiceInput["billTo"]) {
  return {
    name: billTo.name,
    company: billTo.company === "" ? null : billTo.company,
    trn: billTo.trn === "" ? null : billTo.trn,
    address: billTo.address === "" ? null : billTo.address,
  };
}
