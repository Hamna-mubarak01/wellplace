import { messageFooterDesignSchema } from "@/lib/validation/message-footer";
import { messageHeaderDesignSchema } from "@/lib/validation/message-header";
import { z } from "zod";
import { MESSAGE_COLUMNS_LIMITS } from "@/lib/config/message-text";
import { messageTextAppearanceSchema } from "@/lib/validation/message-text";
import { messageButtonAppearanceSchema } from "@/lib/validation/message-button";
import { MESSAGE_TIMING_MAX } from "@/lib/config/message-templates";
import { sanitizeEmailHtml } from "@/lib/validation/email-html";

import {
  MESSAGE_DOCUMENT_LIMITS as L,
  sampleValues,
  variableCatalogue,
  type SystemMessageKey,
} from "@/lib/config/message-documents";
import {
  BLOCK_ALIGNMENTS,
  IMAGE_WIDTH,
  SPACER_HEIGHT,
  TEXT_SIZES,
  VARIABLE_NAME,
  inspectDocument,
  type AuthoredDocument,
  type DocumentProblem,
} from "@/lib/domain/email/document";

const inlineText = z.object({
  kind: z.literal("text"),
  text: z.string().max(L.textMax),
  bold: z.boolean(),
  italic: z.boolean(),
  underline: z.boolean(),
});

const inlineVariable = z.object({
  kind: z.literal("variable"),
  name: z.string().regex(VARIABLE_NAME, "That is not a variable we recognise."),
});

const linkable = z.discriminatedUnion("kind", [inlineText, inlineVariable]);

const href = z.string().trim().max(L.hrefMax);

const inlineLink = z.object({
  kind: z.literal("link"),
  href,
  label: z.array(linkable).min(1).max(L.inlineNodesMax),
});

const inline = z.discriminatedUnion("kind", [
  inlineText,
  inlineVariable,
  inlineLink,
]);

const linkableRun = z.array(linkable).max(L.inlineNodesMax);

const inlineRun = z.array(inline).max(L.inlineNodesMax);

const id = z.string().trim().min(1).max(64);

export const authoredBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("band"), id, content: inlineRun }),
  z.object({ kind: z.literal("quote"), id, content: inlineRun }),
  z.object({
    kind: z.literal("columns"),
    id,
    columns: z
      .array(inlineRun)
      .min(MESSAGE_COLUMNS_LIMITS.min)
      .max(MESSAGE_COLUMNS_LIMITS.max),
  }),
  z.object({
    kind: z.literal("hero"),
    id,
    src: href,
    alt: z.string().max(L.altMax),
    content: inlineRun,
  }),
  z.object({
    kind: z.literal("video"),
    id,
    src: href,
    alt: z.string().max(L.altMax),
    href,
    label: linkableRun,
  }),
  z.object({ kind: z.literal("file"), id, href, label: linkableRun }),
  z.object({
    kind: z.literal("html"),
    id,
    markup: z.string().max(L.htmlMax).transform(sanitizeEmailHtml),
  }),
  z.object({
    kind: z.literal("eyebrow"),
    id,
    appearance: messageTextAppearanceSchema.optional(),
    content: linkableRun,
  }),
  z.object({
    kind: z.literal("heading"),
    id,
    appearance: messageTextAppearanceSchema.optional(),
    content: linkableRun,
  }),
  z.object({
    kind: z.literal("lead"),
    id,
    appearance: messageTextAppearanceSchema.optional(),
    content: inlineRun,
  }),
  z.object({
    kind: z.literal("text"),
    id,
    appearance: messageTextAppearanceSchema.optional(),
    content: inlineRun,
    align: z.enum(BLOCK_ALIGNMENTS),
    size: z.enum(TEXT_SIZES),
  }),
  z.object({
    kind: z.literal("note"),
    id,
    appearance: messageTextAppearanceSchema.optional(),
    content: inlineRun,
  }),
  z.object({
    kind: z.literal("panel"),
    id,
    rows: z
      .array(z.object({ label: linkableRun, value: linkableRun }))
      .max(L.panelRowsMax),
  }),
  z.object({
    kind: z.literal("button"),
    id,
    label: linkableRun,
    href,
    appearance: messageButtonAppearanceSchema.optional(),
  }),
  z.object({
    kind: z.literal("links"),
    id,
    label: linkableRun,
    items: z.array(z.object({ label: linkableRun, href })).max(L.linkItemsMax),
  }),
  z.object({ kind: z.literal("divider"), id }),
  z.object({
    kind: z.literal("spacer"),
    id,
    height: z.number().int().min(SPACER_HEIGHT.min).max(SPACER_HEIGHT.max),
  }),
  z.object({
    kind: z.literal("image"),
    id,
    src: href,
    alt: z.string().trim().max(L.altMax),
    width: z.number().int().min(IMAGE_WIDTH.min).max(IMAGE_WIDTH.max),
  }),
]);

export const messageDeliverySchema = z.object({
  channel: z.enum(["email", "whatsapp"]),
  isActive: z.boolean(),
  timingMinutes: z
    .number()
    .int()
    .min(-MESSAGE_TIMING_MAX)
    .max(MESSAGE_TIMING_MAX)
    .nullable(),
});

export const messageFooterSchema = z.string().max(L.textMax, `Keep the footer within ${L.textMax} characters.`);

export const authoredDocumentSchema = z.object({
  footer: messageFooterSchema.optional(),
  footerDesign: messageFooterDesignSchema.optional(),
  headerDesign: messageHeaderDesignSchema.optional(),
  name: z.string().trim().max(L.templateNameMax).optional(),
  delivery: messageDeliverySchema.optional(),
  branding: z.boolean().optional(),
  subject: linkableRun,
  preheader: linkableRun,
  whatsapp: linkableRun.optional(),
  blocks: z.array(authoredBlockSchema).max(L.blocksMax),
});

export function parseStoredDocument(value: unknown): AuthoredDocument | null {
  const parsed = authoredDocumentSchema.safeParse(value);
  return parsed.success ? (parsed.data as AuthoredDocument) : null;
}

export function problemMessage(problem: DocumentProblem): string {
  switch (problem.kind) {
    case "subject_blank":
      return "The subject line is empty. Write the line guests read in their inbox.";
    case "no_blocks":
      return "This email has nothing in it. Add a block from the palette.";
    case "renders_empty":
      return "Nothing in this email would reach the guest. Every block is empty or has an address that will not open.";
    case "block_blank":
      return "One block carries no words. Write its wording or remove the block.";
    case "unknown_variable":
      return `“${problem.name}” is not one of this email's details. Remove it and pick one from Insert variable.`;
    case "bad_link":
      return "One block has an address that will not open. Use an https:// address, a mailto: address, or a variable.";
    case "image_without_description":
      return "The picture has no description. Describe it for anyone whose email hides pictures.";
  }
}

export function readyToPublish(
  key: SystemMessageKey,
  document: AuthoredDocument,
):
  | { readonly ok: true }
  | { readonly ok: false; readonly problems: readonly DocumentProblem[] } {
  const problems = inspectDocument(
    document,
    variableCatalogue(key),
    sampleValues(key),
  );
  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}
