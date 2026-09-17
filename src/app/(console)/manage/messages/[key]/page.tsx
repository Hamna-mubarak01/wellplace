import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ConsolePage } from "@/components/console/console-page";
import { EditorWorkspace } from "@/components/console/manage/messages/editor-workspace";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { requireManagement } from "@/lib/auth/session";
import { messageEmailFrame } from "@/lib/config/message-email-frame";
import { emailConfig } from "@/lib/config/email";
import {
  MESSAGE_EDITOR,
  defaultDocument,
  isSystemMessageKey,
  messageSpec,
  sampleValues,
} from "@/lib/config/message-documents";
import { fetchMessageDocument } from "@/lib/db/queries/message-documents";
import { createClient } from "@/lib/db/server";
import type { AuthoredDocument } from "@/lib/domain/email/document";
import { parseStoredDocument } from "@/lib/validation/message-document";

export const metadata: Metadata = {
  title: "Message template",
  robots: { index: false, follow: false },
};

const BLANK: AuthoredDocument = { subject: [], preheader: [], blocks: [] };

export default async function MessageTemplateEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const session = await requireManagement();

  const { key } = await params;
  const { preview } = await searchParams;
  if (!isSystemMessageKey(key)) notFound();

  const spec = messageSpec(key);
  const supabase = await createClient();
  const found = await fetchMessageDocument(supabase, key);

  if (!found.ok) {
    console.error(`[messages] ${key} could not be opened: ${found.message}`);
    return (
      <ConsolePage title={spec.label}>
        <ConsoleReadError
          title="This message could not be opened"
          message={found.message}
          meaning="Its saved wording could not be read, so the editor would show the built-in wording instead of yours."
          remedy="Reload the page before changing anything, so you do not save over wording you cannot see."
        />
      </ConsolePage>
    );
  }

  const row = found.template;

  const document =
    parseStoredDocument(row?.draftDocument) ??
    parseStoredDocument(row?.document) ??
    defaultDocument(key) ??
    BLANK;

  const config = emailConfig();
  const staffFacing = spec.audience === "staff";

  return (
    <EditorWorkspace
      recoveryKey={`${MESSAGE_EDITOR.recoveryStoragePrefix}:${session.userId}:${key}`}
      emailFrame={messageEmailFrame(key, config, row?.footer, row?.footerDesign, row?.headerDesign)}
      spec={spec}
      previewOpen={preview === "1"}
      document={document}
      settings={
        document.delivery ?? {
          channel: row?.channel ?? "email",
          isActive: row?.isActive ?? true,
          timingMinutes: row?.timingMinutes ?? null,
        }
      }
      savedAt={row?.draftUpdatedAt ?? row?.documentUpdatedAt ?? null}
      canReset={row?.isPublished === true || row?.hasDraft === true}
      fromName={staffFacing ? config.operationsFromName : config.guestFromName}
      fromEmail={staffFacing ? config.operationsFrom : config.guestFrom}
      recipients={[
        {
          id: "sample",
          label: staffFacing ? "The team" : "A sample guest",
          email: staffFacing
            ? config.operationsTo[0]
            : (sampleValues(key).email ?? config.guestFrom),
          values: sampleValues(key),
        },
      ]}
    />
  );
}
