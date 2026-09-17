import { z } from "zod";
import type { AuthoredDocument } from "@/lib/domain/email/document";
import {
  authoredDocumentSchema,
  messageDeliverySchema,
} from "@/lib/validation/message-document";

export const messageDraftSchema = z.object({
  document: authoredDocumentSchema,
  settings: messageDeliverySchema,
});

export const messageRecoverySchema = z.object({
  owner: z.string(),
  savedAt: z.string().nullable(),
  draft: messageDraftSchema,
});

// [OUR CHOICE] Parsed JSON can reorder fields; identical drafts must compare equally.
export function messageDraftSignature(draft: {
  document: AuthoredDocument;
  settings: z.infer<typeof messageDeliverySchema>;
}): string {
  return JSON.stringify(draft, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
        )
      : value,
  );
}

export function parseMessageRecovery(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = messageRecoverySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
