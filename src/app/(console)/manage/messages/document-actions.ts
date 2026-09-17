"use server";

import { messageFooterDesignSchema } from "@/lib/validation/message-footer";
import { messageHeaderDesignSchema } from "@/lib/validation/message-header";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManagement } from "@/lib/auth/session";
import { CMS_IMAGE_TYPES, cmsMediaType } from "@/lib/config/cms/media";
import {
  uploadCmsMedia,
  type CmsUploadResult,
} from "@/lib/services/cms-media-service";
import { testRecipientSchema } from "@/lib/validation/message-test";
import { emailConfig } from "@/lib/config/email";
import {
  SYSTEM_MESSAGE_KEYS,
  messageSpec,
  sampleValues,
  type SystemMessageKey,
} from "@/lib/config/message-documents";
import { fetchMessageDocument } from "@/lib/db/queries/message-documents";
import { createClient } from "@/lib/db/server";
import {
  applyEmailFooterToAll,
  applyEmailHeaderToAll,
  publishMessageTemplate,
  resetMessageTemplate,
  saveMessageTemplateDraft,
  type BookingMutation,
} from "@/lib/db/rpc";
import {
  inlineToText,
  type AuthoredDocument,
} from "@/lib/domain/email/document";
import { emailAdapter } from "@/lib/messaging/mailer";
import { authoredEmail } from "@/lib/messaging/templates/authored";
import type { Json } from "@/types/database.generated";
import {
  authoredDocumentSchema,
  messageFooterSchema,
  messageDeliverySchema,
  problemMessage,
  readyToPublish,
} from "@/lib/validation/message-document";

export type DocumentActionResult =
  { ok: true; message?: string } | { ok: false; message: string };

const settingsSchema = messageDeliverySchema;

const draftSchema = z.object({
  key: z.enum(SYSTEM_MESSAGE_KEYS),
  document: authoredDocumentSchema,
  settings: settingsSchema,
});

function refresh(key: SystemMessageKey): void {
  revalidatePath("/manage/messages");
  revalidatePath(`/manage/messages/${key}`);
}

function explain(result: BookingMutation<unknown>): string {
  if (result.outcome === "ok") return "";
  if (result.outcome === "no_suite") return "That change was not saved.";
  const { message } = result;
  if (message.includes("WP083"))
    return "There is nothing to publish. Save a draft first.";
  if (message.includes("WP082"))
    return "There is nothing to undo on this message.";
  if (message.includes("WP084")) return "Write the message before saving it.";
  if (message.includes("42501")) return "You do not have permission for that.";
  return message;
}

async function persist(
  key: SystemMessageKey,
  document: AuthoredDocument,
  settings: z.infer<typeof settingsSchema>,
): Promise<DocumentActionResult> {
  const supabase = await createClient();

  const before = await fetchMessageDocument(supabase, key);
  if (!before.ok)
    return {
      ok: false,
      message: explain({ outcome: "failed", message: before.message }),
    };

  const saved = await saveMessageTemplateDraft(supabase, {
    key,
    document: { ...document, delivery: settings } as unknown as Json,
    subject: inlineToText(document.subject, {}).trim() || null,
    preheader: inlineToText(document.preheader, {}).trim() || null,
  });

  if (saved.outcome !== "ok") return { ok: false, message: explain(saved) };

  return { ok: true };
}

export async function saveMessageDocumentDraft(
  raw: unknown,
): Promise<DocumentActionResult> {
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };

  await requireManagement();

  const document = parsed.data.document as AuthoredDocument;
  const result = await persist(parsed.data.key, document, parsed.data.settings);
  if (result.ok) refresh(parsed.data.key);
  return result;
}

export async function publishMessageDocument(
  raw: unknown,
): Promise<DocumentActionResult> {
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };

  await requireManagement();

  const document = parsed.data.document as AuthoredDocument;
  const ready = readyToPublish(parsed.data.key, document);
  if (!ready.ok)
    return { ok: false, message: problemMessage(ready.problems[0]) };

  const saved = await persist(parsed.data.key, document, parsed.data.settings);
  if (!saved.ok) return saved;

  const supabase = await createClient();
  const published = await publishMessageTemplate(supabase, {
    key: parsed.data.key,
  });
  if (published.outcome !== "ok")
    return { ok: false, message: explain(published) };

  refresh(parsed.data.key);
  return {
    ok: true,
    message: messageSpec(parsed.data.key).connected
      ? "Published. Future emails will use this wording."
      : "Template published. Automated delivery is not connected yet.",
  };
}

export async function resetMessageDocument(
  raw: unknown,
): Promise<DocumentActionResult> {
  const parsed = z.object({ key: z.enum(SYSTEM_MESSAGE_KEYS) }).safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "That is not a message this screen can change.",
    };

  await requireManagement();

  const supabase = await createClient();
  const result = await resetMessageTemplate(supabase, { key: parsed.data.key });
  if (result.outcome !== "ok") return { ok: false, message: explain(result) };

  refresh(parsed.data.key);
  return { ok: true, message: "The built-in wording is back." };
}

export async function sendMessageDocumentTest(
  raw: unknown,
): Promise<DocumentActionResult> {
  await requireManagement();

  const parsed = z
    .object({
      key: z.enum(SYSTEM_MESSAGE_KEYS),
      document: authoredDocumentSchema,
      recipientEmail: testRecipientSchema,
    })
    .safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues.some(
        (issue) => issue.path[0] === "recipientEmail",
      )
        ? "Enter one valid email address to receive the test."
        : "Check the wording before sending a test.",
    };

  const document = parsed.data.document as AuthoredDocument;
  const ready = readyToPublish(parsed.data.key, document);
  if (!ready.ok)
    return { ok: false, message: problemMessage(ready.problems[0]) };

  const message = authoredEmail({
    key: parsed.data.key,
    stored: document,
    values: sampleValues(parsed.data.key),
    to: parsed.data.recipientEmail,
  });

  if (message === null)
    return { ok: false, message: "This message could not be built." };

  const adapter = emailAdapter();

  const config = emailConfig();
  const sent = await adapter.send({
    ...message,
    to: parsed.data.recipientEmail,
    replyTo: config.operationsTo[0],
    subject: `[Test] ${message.subject}`,
  });

  if (!sent.ok) {
    console.error(
      `[messages] test send failed (${sent.reason}): ${sent.message}`,
    );
    return {
      ok: false,
      message: "The test could not be sent. Check the email provider settings.",
    };
  }

  return { ok: true, message: `Test sent to ${parsed.data.recipientEmail}.` };
}

export async function uploadMessageImage(
  formData: FormData,
): Promise<CmsUploadResult> {
  await requireManagement();
  const file = formData.get("file");
  if (
    !(file instanceof File) ||
    !CMS_IMAGE_TYPES.some((type) => type === cmsMediaType(file))
  ) {
    return { ok: false, message: "Choose a supported image to upload." };
  }
  return uploadCmsMedia(await createClient(), "message-templates", file);
}

export async function applyMessageFooterToAll(raw: unknown): Promise<DocumentActionResult> {
  await requireManagement();
  const parsed = z.object({ footer: messageFooterSchema, footerDesign: messageFooterDesignSchema.optional() }).safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const result = await applyEmailFooterToAll(await createClient(), {
    footer: parsed.data.footer,
    footerDesign: parsed.data.footerDesign,
    keys: SYSTEM_MESSAGE_KEYS,
  });
  if (result.outcome !== "ok") return { ok: false, message: explain(result) };
  revalidatePath("/manage/messages");
  for (const key of SYSTEM_MESSAGE_KEYS) revalidatePath(`/manage/messages/${key}`);
  return { ok: true, message: `Footer applied to ${result.value.updatedCount} email templates. Other content was kept.` };
}

export async function applyMessageHeaderToAll(raw: unknown): Promise<DocumentActionResult> {
  await requireManagement();
  const parsed = z.object({ headerDesign: messageHeaderDesignSchema }).safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const result = await applyEmailHeaderToAll(await createClient(), {
    headerDesign: parsed.data.headerDesign,
    keys: SYSTEM_MESSAGE_KEYS,
  });
  if (result.outcome !== "ok") return { ok: false, message: explain(result) };
  revalidatePath("/manage/messages");
  for (const key of SYSTEM_MESSAGE_KEYS) revalidatePath(`/manage/messages/${key}`);
  return { ok: true, message: `Header applied to ${result.value.updatedCount} email templates. Other content was kept.` };
}
