import type { EmailFooterDesign } from "@/lib/domain/email/footer";
import { messageFooterDesignSchema } from "@/lib/validation/message-footer";
import type { EmailHeaderDesign } from "@/lib/domain/email/header";
import { messageHeaderDesignSchema } from "@/lib/validation/message-header";
import { z } from "zod";

import { isSystemMessageKey, type SystemMessageKey } from "@/lib/config/message-documents";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Json } from "@/types/database.generated";

const COLUMNS =
  "header_design, footer_design, footer, key, channel, is_active, is_marketing, subject, preheader, body, timing_minutes, " +
  "document, draft_document, draft_subject, draft_preheader, is_published, has_draft, " +
  "published_blocks, draft_blocks, document_updated_at, draft_updated_at, updated_at";

const documentRowSchema = z.object({
  footer: z.string().nullable().optional(),
  footer_design: messageFooterDesignSchema.nullish(),
  header_design: messageHeaderDesignSchema.nullish(),
  key: z.string(),
  channel: z.enum(["email", "whatsapp"]),
  is_active: z.boolean(),
  is_marketing: z.boolean(),
  subject: z.string().nullable(),
  preheader: z.string().nullable(),
  body: z.string().nullable(),
  timing_minutes: z.number().int().nullable(),
  document: z.unknown().nullable(),
  draft_document: z.unknown().nullable(),
  draft_subject: z.string().nullable(),
  draft_preheader: z.string().nullable(),
  is_published: z.boolean(),
  has_draft: z.boolean(),
  published_blocks: z.number().int(),
  draft_blocks: z.number().int(),
  document_updated_at: z.string().nullable(),
  draft_updated_at: z.string().nullable(),
  updated_at: z.string(),
});

export interface MessageDocumentRow {
  footer?: string | null;
  footerDesign?: EmailFooterDesign | null;
  headerDesign?: EmailHeaderDesign | null;
  key: SystemMessageKey;
  channel: "email" | "whatsapp";
  isActive: boolean;
  isMarketing: boolean;
  subject: string | null;
  preheader: string | null;
  body: string | null;
  timingMinutes: number | null;
  document: Json | null;
  draftDocument: Json | null;
  draftSubject: string | null;
  draftPreheader: string | null;
  isPublished: boolean;
  hasDraft: boolean;
  publishedBlocks: number;
  draftBlocks: number;
  documentUpdatedAt: string | null;
  draftUpdatedAt: string | null;
  updatedAt: string;
}

export type MessageDocumentListing =
  | { ok: true; templates: MessageDocumentRow[] }
  | { ok: false; message: string };

function toRow(row: z.infer<typeof documentRowSchema>): MessageDocumentRow | null {
  if (!isSystemMessageKey(row.key)) return null;

  return {
    footer: row.footer,
    footerDesign: row.footer_design,
    headerDesign: row.header_design,
    key: row.key,
    channel: row.channel,
    isActive: row.is_active,
    isMarketing: row.is_marketing,
    subject: row.subject,
    preheader: row.preheader,
    body: row.body,
    timingMinutes: row.timing_minutes,
    document: (row.document ?? null) as Json | null,
    draftDocument: (row.draft_document ?? null) as Json | null,
    draftSubject: row.draft_subject,
    draftPreheader: row.draft_preheader,
    isPublished: row.is_published,
    hasDraft: row.has_draft,
    publishedBlocks: row.published_blocks,
    draftBlocks: row.draft_blocks,
    documentUpdatedAt: row.document_updated_at,
    draftUpdatedAt: row.draft_updated_at,
    updatedAt: row.updated_at,
  };
}

export async function listMessageDocuments(
  client: WellPlaceClient,
): Promise<MessageDocumentListing> {
  const { data, error } = await client
    .from("message_documents")
    .select(COLUMNS)
    .order("key", { ascending: true });

  if (error) return { ok: false, message: error.message };

  const parsed = z.array(documentRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    return {
      ok: false,
      message: `Unexpected shape from message_documents: ${parsed.error.message}`,
    };
  }

  const templates: MessageDocumentRow[] = [];
  for (const row of parsed.data) {
    const mapped = toRow(row);
    if (mapped !== null) templates.push(mapped);
  }

  return { ok: true, templates };
}

export type MessageDocumentRead =
  | { ok: true; template: MessageDocumentRow | null }
  | { ok: false; message: string };

export async function fetchMessageDocument(
  client: WellPlaceClient,
  key: SystemMessageKey,
): Promise<MessageDocumentRead> {
  const { data, error } = await client
    .from("message_documents")
    .select(COLUMNS)
    .eq("key", key)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (data === null) return { ok: true, template: null };

  const parsed = documentRowSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      message: `Unexpected shape from message_documents: ${parsed.error.message}`,
    };
  }

  return { ok: true, template: toRow(parsed.data) };
}
