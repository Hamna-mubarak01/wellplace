"use client";

import type { MessageEmailFrame } from "@/lib/config/message-email-frame";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  applyMessageFooterToAll,
  applyMessageHeaderToAll,
  publishMessageDocument,
  resetMessageDocument,
  saveMessageDocumentDraft,
  sendMessageDocumentTest,
} from "@/app/(console)/manage/messages/document-actions";
import {
  TemplateEditor,
  type TemplateDraft,
} from "@/components/console/manage/messages/template-editor";
import type { PreviewRecipient } from "@/components/console/manage/messages/template-preview";
import type { TemplateSettingsValue } from "@/components/console/manage/messages/template-settings";
import {
  defaultDocument,
  type SystemMessageSpec,
} from "@/lib/config/message-documents";
import type { AuthoredDocument } from "@/lib/domain/email/document";

export interface EditorWorkspaceProps {
  readonly recoveryKey?: string;
  readonly spec: SystemMessageSpec;
  readonly document: AuthoredDocument;
  readonly settings: TemplateSettingsValue;
  readonly savedAt: string | null;
  readonly canReset: boolean;
  readonly fromName: string;
  emailFrame?: MessageEmailFrame;
  readonly fromEmail: string;
  readonly recipients: readonly PreviewRecipient[];
  readonly previewOpen?: boolean;
}

export function EditorWorkspace({
  recoveryKey,
  spec,
  document,
  settings,
  savedAt,
  canReset,
  fromName,
  emailFrame,
  fromEmail,
  recipients,
  previewOpen = false,
}: EditorWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSentTo, setTestSentTo] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [resetDocument, setResetDocument] = useState<AuthoredDocument | null>(
    null,
  );
  const [revision, setRevision] = useState(0);

  async function run(
    draft: TemplateDraft,
    action: typeof saveMessageDocumentDraft,
    success: string,
  ): Promise<boolean> {
    setSaveError(null);
    return new Promise((resolve) =>
      startTransition(async () => {
        try {
          const result = await action({
            key: spec.key,
            document: draft.document,
            settings: draft.settings,
          });
          if (result.ok) {
            toast.success(result.message ?? success);
            router.refresh();
            resolve(true);
            return;
          }
          setSaveError(result.message);
          toast.error(result.message);
          resolve(false);
        } catch {
          setSaveError(
            "Your changes could not be saved. Check your connection and try again.",
          );
          resolve(false);
        }
      }),
    );
  }

  return (
    <TemplateEditor
      key={`${spec.key}:${revision}`}
      spec={spec}
      recoveryKey={recoveryKey}
      initialDocument={resetDocument ?? document}
      initialSettings={settings}
      savedAt={savedAt}
      closeHref="/manage/messages"
      emailFrame={emailFrame}
      fromName={fromName}
      fromEmail={fromEmail}
      recipients={recipients}
      previewOpen={previewOpen}
      saving={pending}
      saveError={saveError}
      sendingTest={sendingTest}
      testError={testError}
      testSentTo={testSentTo}
      canReset={canReset}
      onApplyFooterToAll={(footer, footerDesign) => new Promise((resolve) => {
        setSaveError(null);
        startTransition(async () => {
          try {
            const result = await applyMessageFooterToAll({ footer, footerDesign });
            if (result.ok) {
              toast.success(result.message ?? "Footer applied to all email templates.");
              router.refresh();
              resolve(true);
            } else {
              setSaveError(result.message);
              toast.error(result.message);
              resolve(false);
            }
          } catch {
            setSaveError("The footer could not be applied. Check your connection and try again.");
            resolve(false);
          }
        });
      })}
      onApplyHeaderToAll={(headerDesign) => new Promise((resolve) => {
        setSaveError(null);
        startTransition(async () => {
          try {
            const result = await applyMessageHeaderToAll({ headerDesign });
            if (result.ok) {
              toast.success(result.message ?? "Header applied to all email templates.");
              router.refresh();
              resolve(true);
            } else {
              setSaveError(result.message);
              toast.error(result.message);
              resolve(false);
            }
          } catch {
            setSaveError("The header could not be applied. Check your connection and try again.");
            resolve(false);
          }
        });
      })}
      onAutoSave={async (draft) => {
        setSaveError(null);
        try {
          const result = await saveMessageDocumentDraft({
            key: spec.key,
            document: draft.document,
            settings: draft.settings,
          });
          if (result.ok) {
            router.refresh();
            return true;
          }
          setSaveError(result.message);
        } catch {
          setSaveError(
            "Autosave could not finish. Your edits are still here. Use Save draft to retry.",
          );
        }
        return false;
      }}
      onSaveDraft={(draft) =>
        run(draft, saveMessageDocumentDraft, "Draft saved.")
      }
      onPublish={(draft) => run(draft, publishMessageDocument, "Published.")}
      onResetToDefault={() => {
        setSaveError(null);
        startTransition(async () => {
          try {
            const result = await resetMessageDocument({ key: spec.key });
            if (result.ok) {
              try {
                if (recoveryKey) window.localStorage.removeItem(recoveryKey);
              } catch {}
              toast.success(result.message ?? "The built-in wording is back.");
              setResetDocument(
                defaultDocument(spec.key) ?? {
                  subject: [],
                  preheader: [],
                  blocks: [],
                },
              );
              setRevision((current) => current + 1);
              router.refresh();
              return;
            }
            setSaveError(result.message);
            toast.error(result.message);
          } catch {
            setSaveError(
              "The template could not be restored. Check your connection and try again.",
            );
          }
        });
      }}
      onSendTest={async (currentDocument, recipientEmail) => {
        setTestError(null);
        setTestSentTo(null);
        setSendingTest(true);
        return sendMessageDocumentTest({
          key: spec.key,
          document: currentDocument,
          recipientEmail,
        })
          .then((result) => {
            if (result.ok) {
              setTestSentTo(result.message ?? "Test sent.");
              toast.success(result.message ?? "Test sent.");
              return true;
            }
            setTestError(result.message);
            toast.error(result.message);
            return false;
          })
          .catch(() => {
            setTestError(
              "The test could not be sent. Check your connection and try again.",
            );
            return false;
          })
          .finally(() => setSendingTest(false));
      }}
    />
  );
}
