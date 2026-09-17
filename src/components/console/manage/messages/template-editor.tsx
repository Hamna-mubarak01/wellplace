"use client";

import type { EmailFooterDesign } from "@/lib/domain/email/footer";
import { messageFooterDesignSchema } from "@/lib/validation/message-footer";
import type { EmailHeaderDesign } from "@/lib/domain/email/header";
import { messageHeaderDesignSchema } from "@/lib/validation/message-header";
import { DEFAULT_HEADER_DESIGN } from "@/lib/config/message-header";
import { HeaderSettings } from "@/components/console/manage/messages/header-settings";

import type { MessageEmailFrame } from "@/lib/config/message-email-frame";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  BookmarkIcon,
  GlobeIcon,
  PanelTopIcon,
  PencilIcon,
  BlocksIcon,
  CheckIcon,
  ChevronLeftIcon,
  ListTreeIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RedoIcon,
  RotateCcwIcon,
  SaveIcon,
  SettingsIcon,
  UndoIcon,
  XIcon,
} from "lucide-react";

import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";
import { ConsoleIconAction } from "@/components/console/shared/console-icon-action";
import { FooterSettings } from "@/components/console/manage/messages/footer-settings";
import { footerFor, editableFooterDesign } from "@/lib/config/message-email-frame";
import { messageFooterSchema } from "@/lib/validation/message-document";
import { BlockCanvas } from "@/components/console/manage/messages/block-canvas";
import { BlockPalette } from "@/components/console/manage/messages/block-palette";
import { SavedBlocks } from "@/components/console/manage/messages/saved-blocks";
import { BlockSettings } from "@/components/console/manage/messages/block-settings";
import { DocumentProblems } from "@/components/console/manage/messages/document-problems";
import { EditorSection } from "@/components/console/manage/messages/editor-section";
import {
  editorHistory,
  blockTypingGroup,
  startHistory,
  type TemplateDraft,
} from "@/components/console/manage/messages/editor-history";
import {
  SaveStatus,
  type SaveState,
} from "@/components/console/manage/messages/save-status";
import {
  TemplatePreview,
  type PreviewRecipient,
} from "@/components/console/manage/messages/template-preview";
import {
  TemplateSettings,
  type TemplateSettingsValue,
} from "@/components/console/manage/messages/template-settings";
import {
  BLOCK_META,
  blockLabel,
  blockSummary,
  createBlock,
  duplicateBlock,
  duplicatedBlockId,
  insertBlock,
  moveBlock,
  problemBlockId,
  removeBlock,
  replaceBlock,
} from "@/components/console/manage/messages/message-document-model";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import { FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDraftRecovery } from "./use-draft-recovery";
import { messageDraftSignature } from "@/lib/validation/message-draft";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MESSAGE_DOCUMENT_LIMITS,
  MESSAGE_EDITOR,
  variableCatalogue,
  type SystemMessageSpec,
} from "@/lib/config/message-documents";
import {
  inspectDocument,
  type AuthoredBlock,
  type AuthoredBlockKind,
  type AuthoredDocument,
} from "@/lib/domain/email/document";
import { cn } from "@/lib/utils";

export type { TemplateDraft } from "@/components/console/manage/messages/editor-history";

export interface TemplateEditorProps {
  spec: SystemMessageSpec;
  initialDocument: AuthoredDocument;
  initialSettings: TemplateSettingsValue;
  savedAt: string | null;
  closeHref: string;
  fromName: string;
  emailFrame?: MessageEmailFrame;
  fromEmail: string;
  recipients: readonly PreviewRecipient[];
  saving?: boolean;
  saveError?: string | null;
  sendingTest?: boolean;
  testError?: string | null;
  testSentTo?: string | null;
  canReset?: boolean;
  recoveryKey?: string;
  onApplyFooterToAll?: (footer: string, design: EmailFooterDesign) => Promise<boolean>;
  onApplyHeaderToAll?: (design: EmailHeaderDesign) => Promise<boolean>;
  onAutoSave?: (draft: TemplateDraft) => Promise<boolean>;
  onSaveDraft: (draft: TemplateDraft) => Promise<boolean>;
  onPublish: (draft: TemplateDraft) => Promise<boolean>;
  onResetToDefault?: () => void;
  onSendTest?: (
    document: AuthoredDocument,
    recipientEmail: string,
  ) => Promise<boolean>;
  previewOpen?: boolean;
  className?: string;
}

export function TemplateEditor({
  spec,
  initialDocument,
  initialSettings,
  savedAt,
  closeHref,
  fromName,
  fromEmail,
  emailFrame,
  recipients,
  saving = false,
  saveError = null,
  sendingTest = false,
  testError = null,
  testSentTo = null,
  canReset = false,
  recoveryKey,
  onApplyFooterToAll,
  onApplyHeaderToAll,
  onAutoSave,
  onSaveDraft,
  onPublish,
  onResetToDefault,
  onSendTest,
  previewOpen = false,
  className,
}: TemplateEditorProps) {
  const router = useRouter();
  const [history, dispatch] = useReducer(
    editorHistory,
    { document: { ...initialDocument, headerDesign: initialDocument.headerDesign ?? emailFrame?.headerDesign ?? DEFAULT_HEADER_DESIGN, footerDesign: initialDocument.footerDesign ?? editableFooterDesign(emailFrame), footer: initialDocument.footer ?? (emailFrame?.footerLines ?? footerFor(spec.key)).join("\n") }, settings: initialSettings },
    startHistory,
  );
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(savedAt);
  const saveInFlight = useRef(false);
  const failedAutoSave = useRef<string | null>(null);
  const [baseline, setBaseline] = useState(history.present);
  const [footerEditing, setFooterEditing] = useState(false);
  const [applyingFooter, setApplyingFooter] = useState(false);
  const [appliedFooter, setAppliedFooter] = useState(() => JSON.stringify({ text: history.present.document.footer, design: history.present.document.footerDesign }));
  const [appliedHeader, setAppliedHeader] = useState(() => JSON.stringify(history.present.document.headerDesign));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sections, setSections] = useState({
    settings: true,
    blocks: true,
    saved: true,
    header: false,
    footer: false,
  });
  const [resetting, setResetting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [timingValid, setTimingValid] = useState(true);
  const [tab, setTab] = useState("blocks");
  const canvas = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const draft = history.present.document;
  const settings = history.present.settings;
  const footer = draft.footer ?? (emailFrame?.footerLines ?? footerFor(spec.key)).join("\n");
  const footerDesign = draft.footerDesign ?? editableFooterDesign(emailFrame);
  const headerDesign = draft.headerDesign ?? emailFrame?.headerDesign ?? DEFAULT_HEADER_DESIGN;
  const headerChanged = JSON.stringify(headerDesign) !== appliedHeader;
  const footerChanged = JSON.stringify({ text: footer, design: footerDesign }) !== appliedFooter;
  const footerValid =
    messageFooterSchema.safeParse(footer).success &&
    messageFooterDesignSchema.safeParse(footerDesign).success &&
    messageHeaderDesignSchema.safeParse(headerDesign).success;
  const dirty =
    messageDraftSignature(baseline) !== messageDraftSignature(history.present);
  const recovery = useDraftRecovery({
    storageKey: recoveryKey,
    current: history.present,
    baseline,
    savedAt,
  });
  const state: SaveState =
    saving || autoSaving
      ? "saving"
      : saveError !== null
        ? "error"
        : dirty
          ? "unsaved"
          : "clean";
  const problems = useMemo(
    () => inspectDocument(draft, variableCatalogue(spec.key)),
    [draft, spec.key],
  );
  const selected =
    draft.blocks.find((block) => block.id === selectedId) ?? null;
  const selectedProblems = problems.filter(
    (problem) => problemBlockId(problem) === selectedId,
  );

  useEffect(() => {
    const submitted = history.present;
    const signature = messageDraftSignature(submitted);
    if (
      !onAutoSave ||
      !autoEnabled ||
      !dirty ||
      saving ||
      autoSaving ||
      applyingFooter ||
      !timingValid ||
      !footerValid ||
      resetting ||
      leaving ||
      recovery.candidate ||
      failedAutoSave.current === signature
    )
      return;
    const timer = window.setTimeout(() => {
      if (saveInFlight.current) return;
      saveInFlight.current = true;
      setAutoSaving(true);
      void onAutoSave(submitted)
        .then((success) => {
          if (success) {
            setBaseline(submitted);
            setLastSavedAt(new Date().toISOString());
            failedAutoSave.current = null;
          } else failedAutoSave.current = signature;
        })
        .catch(() => {
          failedAutoSave.current = signature;
        })
        .finally(() => {
          saveInFlight.current = false;
          setAutoSaving(false);
        });
    }, MESSAGE_EDITOR.autosaveDelayMs);
    return () => window.clearTimeout(timer);
  }, [
    onAutoSave,
    autoEnabled,
    dirty,
    saving,
    autoSaving,
    applyingFooter,
    timingValid,
    footerValid,
    resetting,
    leaving,
    recovery.candidate,
    history.present,
  ]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function record(document: AuthoredDocument, group?: string) {
    dispatch({
      type: "change",
      draft: { document, settings },
      group,
      now: Date.now(),
    });
  }

  async function save(publish = false) {
    if (
      saving ||
      autoSaving ||
      saveInFlight.current ||
      !timingValid ||
      !footerValid ||
      (publish && problems.length > 0)
    )
      return;
    saveInFlight.current = true;
    const submitted = history.present;
    try {
      const success = await (publish
        ? onPublish(submitted)
        : onSaveDraft(submitted));
      if (success) {
        setBaseline(submitted);
        setLastSavedAt(new Date().toISOString());
        failedAutoSave.current = null;
      }
    } finally {
      saveInFlight.current = false;
    }
  }

  function editFooter() {
    if (saving || applyingFooter) return;
    setSelectedId(null);
    setFooterEditing(true);
    setSections((current) => ({ ...current, footer: true }));
    requestAnimationFrame(() => {
      rail.current?.querySelector<HTMLElement>("[data-footer-sidebar]")?.scrollIntoView({ block: "start", behavior: "instant" });
      const block = canvas.current?.querySelector<HTMLElement>("[data-footer-block]");
      block?.scrollIntoView({ block: "start", behavior: "instant" });
      block?.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true });
    });
  }

  async function applyFooterToAll(text: string, design: EmailFooterDesign) {
    if (!onApplyFooterToAll || saveInFlight.current || !footerChanged) return false;
    saveInFlight.current = true;
    setApplyingFooter(true);
    try {
      const success = await onApplyFooterToAll(text, design);
      if (success) {
        setAppliedFooter(JSON.stringify({ text, design }));
        setBaseline((previous) => ({ ...previous, document: { ...previous.document, footer: text, footerDesign: design } }));
      }
      return success;
    } finally {
      saveInFlight.current = false;
      setApplyingFooter(false);
    }
  }

  const footerSettingsProps = {
    value: footer,
    design: footerDesign,
    visible: draft.branding !== false,
    disabled: saving || autoSaving || applyingFooter,
    canApplyToAll: footerChanged,
    onChange: (footer: string) => record({ ...draft, footer }, "footer"),
    onDesignChange: (footerDesign: EmailFooterDesign, typingGroup?: string) => record({ ...draft, footerDesign }, typingGroup),
    onApplyToAll: onApplyFooterToAll ? applyFooterToAll : undefined,
  };

  function editHeader() {
    if (saving || applyingFooter) return;
    setSelectedId(null);
    setFooterEditing(false);
    setRailOpen(true);
    setSections((current) => ({ ...current, header: true }));
    requestAnimationFrame(() => {
      rail.current?.querySelector<HTMLElement>("[data-header-sidebar]")?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }

  async function applyHeaderToAll(design: EmailHeaderDesign) {
    if (!onApplyHeaderToAll || saveInFlight.current || !headerChanged) return false;
    saveInFlight.current = true;
    setApplyingFooter(true);
    try {
      const success = await onApplyHeaderToAll(design);
      if (success) {
        setAppliedHeader(JSON.stringify(design));
        setBaseline((previous) => ({ ...previous, document: { ...previous.document, headerDesign: design } }));
      }
      return success;
    } finally {
      saveInFlight.current = false;
      setApplyingFooter(false);
    }
  }

  const headerSettingsProps = {
    design: headerDesign,
    visible: draft.branding !== false,
    disabled: saving || autoSaving || applyingFooter,
    canApplyToAll: headerChanged,
    onDesignChange: (headerDesign: EmailHeaderDesign, typingGroup?: string) => record({ ...draft, headerDesign }, typingGroup),
    onApplyToAll: onApplyHeaderToAll ? applyHeaderToAll : undefined,
  };

  function select(id: string | null, scrollCanvas = false) {
    if (applyingFooter) return;
    setFooterEditing(false);
    if (id === selectedId && railOpen && !scrollCanvas) return;
    setSelectedId(id);
    if (id !== null) {
      setRailOpen(true);
      requestAnimationFrame(() => {
        rail.current
          ?.querySelector("[data-radix-scroll-area-viewport]")
          ?.scrollTo({ top: 0 });
        if (scrollCanvas) {
          const element = canvas.current?.querySelector(
            `[data-block-id="${CSS.escape(id)}"]`,
          );
          element?.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
      });
    }
  }

  function addBlock(kind: AuthoredBlockKind, index?: number) {
    const block = createBlock(kind);
    const selectedIndex = draft.blocks.findIndex(
      (entry) => entry.id === selectedId,
    );
    const next = insertBlock(
      draft,
      block,
      index ?? (selectedIndex < 0 ? draft.blocks.length : selectedIndex + 1),
    );
    if (next === draft) return;
    record(next);
    select(block.id, true);
  }

  function changeBlock(block: AuthoredBlock) {
    record(
      replaceBlock(draft, block),
      blockTypingGroup(
        draft.blocks.find((entry) => entry.id === block.id),
        block,
      ),
    );
  }
  function remove(id: string) {
    record(removeBlock(draft, id));
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div
      className={cn(
        "message-editor @container flex h-dvh min-h-0 flex-col overflow-hidden bg-surface-sunken",
        className,
      )}
      onKeyDown={(event) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        const key = event.key.toLowerCase();
        if (key === "s") {
          event.preventDefault();
          void save();
        }
        if (key === "z" || key === "y") {
          event.preventDefault();
          if (!saving)
            dispatch({ type: key === "y" || event.shiftKey ? "redo" : "undo" });
        }
      }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface-raised px-3 py-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          disabled={saving || autoSaving}
        >
          <Link
            href={closeHref}
            aria-label="Close the editor"
            onClick={(event) => {
              if (saving || autoSaving || dirty) {
                event.preventDefault();
                if (!saving && !autoSaving) setLeaving(true);
              }
            }}
          >
            <XIcon aria-hidden="true" className="size-5" />
          </Link>
        </Button>
        <ConsoleIconAction
          label={railOpen ? "Hide settings" : "Show settings"}
          Icon={railOpen ? PanelLeftCloseIcon : PanelLeftOpenIcon}
          variant="ghost"
          aria-expanded={railOpen}
          aria-controls="message-editor-settings"
          onClick={() => setRailOpen(!railOpen)}
        />
        <div className="flex min-w-0 flex-1 basis-40 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="sr-only">{draft.name?.trim() || spec.label}</h1>
          <Input
            aria-label="Template name in header"
            value={draft.name ?? spec.label}
            maxLength={MESSAGE_DOCUMENT_LIMITS.templateNameMax}
            disabled={saving}
            className="min-h-tap min-w-0 flex-1 basis-48 text-console-title font-medium md:text-console-title"
            onChange={(event) =>
              record({ ...draft, name: event.target.value }, "name")
            }
          />
          <SaveStatus state={state} savedAt={lastSavedAt ?? savedAt} />
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
          {onAutoSave && (
            <div className="flex items-center gap-2 border-r border-border pr-2">
              <FieldLabel htmlFor="message-autosave">Autosave</FieldLabel>
              <ConsoleSwitch
                id="message-autosave"
                checked={autoEnabled}
                disabled={saving}
                onCheckedChange={(enabled) => {
                  failedAutoSave.current = null;
                  setAutoEnabled(enabled);
                }}
              />
            </div>
          )}
          <div className="flex items-center border-r border-border pr-2">
            <ConsoleIconAction
              label="Undo (Ctrl/⌘ Z)"
              Icon={UndoIcon}
              variant="ghost"
              disabled={saving || history.past.length === 0}
              onClick={() => dispatch({ type: "undo" })}
            />
            <ConsoleIconAction
              label="Redo (Ctrl/⌘ Shift Z)"
              Icon={RedoIcon}
              variant="ghost"
              disabled={saving || history.future.length === 0}
              onClick={() => dispatch({ type: "redo" })}
            />
          </div>
          {canReset && onResetToDefault && (
            <ConsoleIconAction
              label="Restore the built-in wording"
              Icon={RotateCcwIcon}
              variant="ghost"
              disabled={saving || autoSaving}
              onClick={() => setResetting(true)}
            />
          )}
          <Button
            variant="outline"
            disabled={saving || autoSaving || !dirty || !timingValid}
            aria-label="Save draft"
            onClick={() => void save()}
          >
            <SaveIcon aria-hidden="true" className="size-4" />
            <span className="sm:hidden">Draft</span>
            <span className="hidden sm:inline">Save draft</span>
          </Button>
          <Button
            disabled={
              saving || autoSaving || problems.length > 0 || !timingValid
            }
            onClick={() => void save(true)}
          >
            <CheckIcon aria-hidden="true" className="size-4" />
            {saving ? "Saving…" : "Publish"}
          </Button>
        </div>
      </header>
      {recovery.candidate && (
        <Alert className="shrink-0 rounded-none border-x-0 border-t-0">
          <AlertTitle>Unsaved work found on this browser</AlertTitle>
          <AlertDescription>
            <p>
              {recovery.candidate.savedAt !== savedAt
                ? "The saved template may have changed since these edits. Review the recovered draft before publishing."
                : "Restore your interrupted edits, or continue with the saved template."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={saving || autoSaving}
                onClick={() => {
                  if (recovery.candidate)
                    dispatch({
                      type: "change",
                      draft: recovery.candidate.draft,
                      now: Date.now(),
                    });
                  recovery.dismiss();
                }}
              >
                Restore draft
              </Button>
              <Button
                variant="ghost"
                disabled={saving || autoSaving}
                onClick={recovery.discard}
              >
                Discard recovery
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      {saveError && (
        <div className="shrink-0 p-3">
          <ActionError
            title="Your changes could not be saved"
            message={saveError}
          />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {railOpen && (
          <aside
            ref={rail}
            id="message-editor-settings"
            aria-label="Email settings and blocks"
            className="message-editor-rail flex min-h-0 w-full shrink-0 flex-col border-b border-border bg-surface-raised md:w-editor-rail md:border-r md:border-b-0"
          >
            <ScrollArea className="min-h-0 flex-1">
              {selected && (
                <section
                  aria-label="Selected block settings"
                  className="border-b border-border"
                >
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface-raised px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => select(null)}
                    >
                      <ChevronLeftIcon aria-hidden="true" className="size-4" />
                      Back to template
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => select(null)}
                    >
                      <CheckIcon aria-hidden="true" className="size-4" />
                      Done
                    </Button>
                  </div>
                  <BlockSettings
                    key={selected.id}
                    block={selected}
                    variables={spec.variables}
                    problems={selectedProblems}
                    disabled={saving}
                    onChange={changeBlock}
                    onRemove={() => remove(selected.id)}
                    className="p-4"
                  />
                </section>
              )}
              <EditorSection
                title="Settings"
                Icon={SettingsIcon}
                open={sections.settings}
                onOpenChange={(open) =>
                  setSections((current) => ({ ...current, settings: open }))
                }
              >
                <TemplateSettings
                  name={draft.name ?? spec.label}
                  onNameChange={(name) => record({ ...draft, name }, "name")}
                  branding={draft.branding !== false}
                  onBrandingChange={(branding) =>
                    record({ ...draft, branding })
                  }
                  spec={spec}
                  subject={draft.subject}
                  preheader={draft.preheader}
                  whatsapp={draft.whatsapp}
                  onWhatsappChange={(whatsapp) => record({ ...draft, whatsapp }, "whatsapp")}
                  settings={settings}
                  disabled={saving}
                  onSubjectChange={(subject) =>
                    record({ ...draft, subject }, "subject")
                  }
                  onPreheaderChange={(preheader) =>
                    record({ ...draft, preheader }, "preheader")
                  }
                  onSettingsChange={(next) =>
                    dispatch({
                      type: "change",
                      draft: { document: draft, settings: next },
                      now: Date.now(),
                    })
                  }
                  onValidityChange={setTimingValid}
                />

              </EditorSection>
              <EditorSection
                title="Blocks"
                Icon={BlocksIcon}
                open={sections.blocks}
                onOpenChange={(open) =>
                  setSections((current) => ({ ...current, blocks: open }))
                }
              >
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="mb-3 grid w-full grid-cols-2 items-stretch gap-1 p-1 group-data-horizontal/tabs:h-auto">
                    <TabsTrigger
                      value="blocks"
                      className="h-tap min-h-tap min-w-0"
                    >
                      <BlocksIcon aria-hidden="true" className="size-4" />
                      Add blocks
                    </TabsTrigger>
                    <TabsTrigger
                      value="outline"
                      className="h-tap min-h-tap min-w-0"
                    >
                      <ListTreeIcon aria-hidden="true" className="size-4" />
                      List view
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="blocks">
                    <BlockPalette
                      blockCount={draft.blocks.length}
                      disabled={saving}
                      onAdd={addBlock}
                    />
                  </TabsContent>
                  <TabsContent value="outline" className="space-y-1">
                    {draft.blocks.length === 0 && (
                      <p className="py-3 text-console-body text-text-muted">
                        Add your first block to start building.
                      </p>
                    )}
                    {draft.blocks.map((block, index) => {
                      const Icon = BLOCK_META[block.kind].Icon;
                      return (
                        <Button
                          key={block.id}
                          variant="ghost"
                          aria-pressed={block.id === selectedId}
                          className="h-auto min-h-tap w-full justify-start py-2"
                          onClick={() => select(block.id, true)}
                        >
                          <Icon aria-hidden="true" className="size-4" />
                          <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                            <span>{blockLabel(block)}</span>
                            <span className="line-clamp-1 text-micro font-normal">
                              {blockSummary(block) || "Empty block"}
                            </span>
                          </span>
                          <span>{index + 1}</span>
                        </Button>
                      );
                    })}
                  </TabsContent>
                </Tabs>
              </EditorSection>
              <EditorSection
                title="Saved blocks"
                Icon={BookmarkIcon}
                open={sections.saved}
                onOpenChange={(open) =>
                  setSections((current) => ({ ...current, saved: open }))
                }
              >
                <SavedBlocks
                  selected={selected}
                  variables={variableCatalogue(spec.key)}
                  disabled={saving}
                  onInsert={(block) => {
                    const index = draft.blocks.findIndex(
                      (entry) => entry.id === selectedId,
                    );
                    const next = insertBlock(
                      draft,
                      block,
                      index < 0 ? draft.blocks.length : index + 1,
                    );
                    if (next !== draft) {
                      record(next);
                      select(block.id, true);
                    }
                  }}
                />
              </EditorSection>
              <EditorSection
                title="Email header"
                Icon={PanelTopIcon}
                badge={<Badge variant="secondary">Global</Badge>}
                open={sections.header}
                onOpenChange={(open) => setSections((current) => ({ ...current, header: open }))}
              >
                <div aria-label="Sidebar header settings" data-header-sidebar className="space-y-4">
                  <p className="text-micro text-text-secondary">Edit this template’s header, then apply it to all emails when ready.</p>
                  <HeaderSettings {...headerSettingsProps} />
                </div>
              </EditorSection>
              <EditorSection
                title="Email footer"
                Icon={GlobeIcon}
                badge={<Badge variant="secondary">Global</Badge>}
                open={sections.footer}
                onOpenChange={(open) => setSections((current) => ({ ...current, footer: open }))}
              >
                <div aria-label="Sidebar footer settings" data-footer-sidebar className="space-y-4">
                  <p className="text-micro text-text-secondary">Edit this template’s footer, then apply it to all emails when ready.</p>
                  <Button variant="outline" className="w-full" disabled={saving || applyingFooter} onClick={editFooter}>
                    <PencilIcon aria-hidden="true" className="size-4" />Edit footer on page
                  </Button>
                  <FooterSettings {...footerSettingsProps} />
                </div>
              </EditorSection>
              <div className="p-4">
                <DocumentProblems
                  problems={problems}
                  labelFor={(id) => {
                    const block = draft.blocks.find((entry) => entry.id === id);
                    return block ? blockLabel(block) : "A block";
                  }}
                  onSelectBlock={(id) => select(id, true)}
                />
              </div>
            </ScrollArea>
          </aside>
        )}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            ref={canvas}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-6 sm:px-8"
            onClick={(event) => {
              if (event.target === event.currentTarget) select(null);
            }}
          >
            <BlockCanvas
              headerDesign={headerDesign}
              onEditHeader={editHeader}
              footerLines={footerFor(spec.key, footer)}
              footerDesign={footerDesign}
              onEditFooter={editFooter}
              onCloseFooter={() => {
                if (applyingFooter) return;
                setFooterEditing(false);
                requestAnimationFrame(() => canvas.current?.querySelector<HTMLButtonElement>("[data-footer-block] button")?.focus({ preventScroll: true }));
              }}
              footerEditing={footerEditing}
              footerEditor={<FooterSettings {...footerSettingsProps} />}
              branding={draft.branding !== false}
              blocks={draft.blocks}
              subject={draft.subject}
              preheader={draft.preheader}
              variables={spec.variables}
              problems={problems}
              selectedBlockId={selectedId}
              disabled={saving || applyingFooter}
              onSelect={select}
              onChange={changeBlock}
              onDuplicate={(id) => {
                const next = duplicateBlock(draft, id);
                record(next);
                select(duplicatedBlockId(draft, next) ?? id, true);
              }}
              onRemove={remove}
              onMove={(id, target) => record(moveBlock(draft, id, target))}
              onAdd={addBlock}
              onAddFirst={() => addBlock("text")}
            />
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-base px-4 py-2 text-micro text-text-muted">
            <span>
              {draft.blocks.length}{" "}
              {draft.blocks.length === 1 ? "block" : "blocks"}
              {selected ? ` · ${blockLabel(selected)} selected` : ""}
            </span>
            <span>
              {recovery.unavailable
                ? "Browser recovery is unavailable. Save your draft before leaving."
                : onAutoSave && autoEnabled
                  ? "Drafts save automatically. Publish to use this wording."
                  : "Save a draft to keep working. Publish to use this wording."}
            </span>
          </footer>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center">
            <div className="pointer-events-auto">
              <TemplatePreview
                emailFrame={emailFrame}
                messageKey={spec.key}
                document={draft}
                fromName={fromName}
                fromEmail={fromEmail}
                recipients={recipients}
                sending={sendingTest}
                sendError={testError}
                sentTo={testSentTo}
                defaultOpen={previewOpen}
                onSendTest={
                  onSendTest
                    ? (recipientEmail) => onSendTest(draft, recipientEmail)
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>
      <AlertDialog open={leaving} onOpenChange={setLeaving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your latest changes will be lost. Save a draft to return to them
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="ghost" hoverEffect="sweep">
                Keep editing
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={() => {
                  recovery.discard();
                  router.push(closeHref);
                }}
              >
                Discard changes
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={resetting} onOpenChange={setResetting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore the built-in wording?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces both your draft and published wording immediately.
              Future emails will use the built-in template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="ghost" hoverEffect="sweep">
                Keep my wording
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                disabled={saving || autoSaving}
                onClick={() => {
                  if (saveInFlight.current) return;
                  setResetting(false);
                  onResetToDefault?.();
                }}
              >
                Restore wording
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
