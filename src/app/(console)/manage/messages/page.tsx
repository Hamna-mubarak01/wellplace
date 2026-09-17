import type { Metadata } from "next";

import { ConsolePage } from "@/components/console/console-page";
import { MessagesWorkspace } from "@/components/console/manage/messages/messages-workspace";
import type { MessageListItem } from "@/components/console/manage/messages/message-list-model";
import { requireManagement } from "@/lib/auth/session";
import {
  SYSTEM_MESSAGES,
  defaultDocument,
  type SystemMessageKey,
} from "@/lib/config/message-documents";
import {
  listMessageDocuments,
  type MessageDocumentRow,
} from "@/lib/db/queries/message-documents";
import { createClient } from "@/lib/db/server";
import {
  inlineToText,
  type AuthoredDocument,
} from "@/lib/domain/email/document";
import { parseStoredDocument } from "@/lib/validation/message-document";

export const metadata: Metadata = {
  title: "Message templates",
  robots: { index: false, follow: false },
};

function documentFor(
  key: SystemMessageKey,
  row: MessageDocumentRow | undefined,
): AuthoredDocument | null {
  const draft =
    row === undefined ? null : parseStoredDocument(row.draftDocument);
  if (draft !== null) return draft;

  const published =
    row === undefined ? null : parseStoredDocument(row.document);
  if (published !== null) return published;

  return defaultDocument(key);
}

function subjectFor(
  row: MessageDocumentRow | undefined,
  document: AuthoredDocument | null,
): string {
  const authored =
    document === null ? "" : inlineToText(document.subject, {}).trim();
  if (authored.length > 0) return authored;
  return row?.draftSubject?.trim() || "";
}

export default async function MessageTemplatesPage() {
  await requireManagement();

  const supabase = await createClient();
  const listing = await listMessageDocuments(supabase);
  const rows = listing.ok ? listing.templates : [];
  const byKey = new Map(rows.map((row) => [row.key, row]));

  const items: readonly MessageListItem[] = SYSTEM_MESSAGES.map((spec) => {
    const row = byKey.get(spec.key);
    const document = documentFor(spec.key, row);
    const status = row?.hasDraft
      ? "draft"
      : row?.isPublished
        ? "published"
        : document !== null
          ? "built_in"
          : "not_written";

    return {
      key: spec.key,
      label: document?.name?.trim() || spec.label,
      group: spec.group,
      audience: spec.audience,
      connected: spec.connected,
      subject: subjectFor(row, document),
      status,
      updatedAt:
        row?.draftUpdatedAt ?? row?.documentUpdatedAt ?? row?.updatedAt ?? null,
      editHref: `/manage/messages/${spec.key}`,
    } satisfies MessageListItem;
  });

  return (
    <ConsolePage title="Message templates" className="min-w-0">
      <MessagesWorkspace
        items={items}
        error={listing.ok ? null : listing.message}
      />
    </ConsolePage>
  );
}
