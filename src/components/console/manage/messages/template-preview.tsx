"use client";

import type { MessageEmailFrame } from "@/lib/config/message-email-frame";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DownloadIcon,
  ChevronDownIcon,
  XIcon,
  MonitorIcon,
  PanelRightOpenIcon,
  SmartphoneIcon,
} from "lucide-react";

import { SendTestDialog } from "./send-test-dialog";
import { Button } from "@/components/shared/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EMAIL_THEME } from "@/lib/messaging/email-theme";
import {
  TEST_RECIPIENT_HINT,
  sampleValues,
  type SystemMessageKey,
} from "@/lib/config/message-documents";
import {
  compileDocument,
  type AuthoredDocument,
} from "@/lib/domain/email/document";
import { footerFor } from "@/lib/config/message-email-frame";
import { renderEmail } from "@/lib/messaging/templates/layout";
import { cn } from "@/lib/utils";

export interface PreviewRecipient {
  readonly id: string;
  readonly label: string;
  readonly email: string;
  readonly values?: Readonly<Record<string, string>>;
}

export interface TemplatePreviewProps {
  messageKey: SystemMessageKey;
  document: AuthoredDocument;
  fromName: string;
  emailFrame?: MessageEmailFrame;
  fromEmail: string;
  recipients: readonly PreviewRecipient[];
  sending?: boolean;
  sendError?: string | null;
  sentTo?: string | null;
  onSendTest?: (recipientEmail: string) => Promise<boolean>;
  defaultOpen?: boolean;
  className?: string;
}

type PreviewWidth = "desktop" | "mobile";

export function TemplatePreview({
  messageKey,
  document,
  fromName,
  emailFrame,
  fromEmail,
  recipients,
  sending = false,
  sendError = null,
  sentTo = null,
  onSendTest,
  defaultOpen = false,
  className,
}: TemplatePreviewProps) {
  const heightObserver = useRef<ResizeObserver | null>(null);
  const [format, setFormat] = useState("email");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [frameHeight, setFrameHeight] = useState(720);
  const [open, setOpen] = useState(defaultOpen);
  const [width, setWidth] = useState<PreviewWidth>("desktop");
  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "");

  useEffect(() => () => heightObserver.current?.disconnect(), [open]);

  const recipient =
    recipients.find((entry) => entry.id === recipientId) ??
    recipients[0] ??
    null;

  const compiled = useMemo(
    () =>
      compileDocument(
        document,
        { ...sampleValues(messageKey), ...(recipient?.values ?? {}) },
        EMAIL_THEME.brand,
      ),
    [document, messageKey, recipient],
  );

  const rendered = useMemo(
    () =>
      renderEmail({
        subject: compiled.subject,
        preheader: compiled.preheader,
        blocks: compiled.blocks,
        assetBaseUrl: "",
        ...emailFrame,
        footerLines: document.footer !== undefined ? footerFor(messageKey, document.footer) : emailFrame?.footerLines ?? footerFor(messageKey),
        branding: document.branding,
        headerDesign: document.headerDesign ?? emailFrame?.headerDesign,
        footerDesign: document.footerDesign ?? emailFrame?.footerDesign,
      }),
    [compiled, messageKey, emailFrame, document.branding, document.footer, document.headerDesign, document.footerDesign],
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-label="Preview this email"
              className={cn(
                "h-preview-tab w-auto gap-2 rounded-r-none px-2 py-4",
                className,
              )}
            >
              <PanelRightOpenIcon aria-hidden="true" className="size-4" />
              <span
                style={{ writingMode: "vertical-rl" }}
                className="text-control"
              >
                Preview
              </span>
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">See what the guest receives</TooltipContent>
      </Tooltip>

      <SheetContent
        side="right"
        showCloseButton={false}
        className="density-console flex w-full! flex-col gap-0 bg-surface-base p-0 sm:max-w-message-preview!"
      >
        <SheetHeader className="shrink-0 gap-1 border-b border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-console-title font-medium">
              Preview
            </SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close preview">
                <XIcon aria-hidden="true" className="size-4" />
              </Button>
            </SheetClose>
          </div>
          <SheetDescription>{TEST_RECIPIENT_HINT}</SheetDescription>
        </SheetHeader>

        <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-border p-4">
          <ToggleGroup
            type="single"
            value={format}
            onValueChange={(next) => {
              if (next) setFormat(next);
            }}
            aria-label="Preview format"
            className="gap-2"
          >
            <ToggleGroupItem
              value="email"
              className="min-h-tap border border-border px-3"
            >
              Email
            </ToggleGroupItem>
            <ToggleGroupItem
              value="text"
              className="min-h-tap border border-border px-3"
            >
              Plain text
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-sm">
            <label
              htmlFor="preview-recipient"
              className="text-console-label font-medium tracking-label text-text-muted uppercase"
            >
              Preview as
            </label>
            <Select
              value={recipient?.id ?? ""}
              disabled={recipients.length === 0}
              onValueChange={setRecipientId}
            >
              <SelectTrigger id="preview-recipient" className="w-full">
                <SelectValue placeholder="No sample recipient" />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((entry) => (
                  <SelectItem
                    key={entry.id}
                    value={entry.id}
                    className="min-h-tap"
                  >
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ToggleGroup
            disabled={format !== "email"}
            type="single"
            value={width}
            aria-label="Preview width"
            onValueChange={(next) => {
              if (next === "desktop" || next === "mobile") setWidth(next);
            }}
            className="gap-2 rounded-none sm:ml-auto"
          >
            <ToggleGroupItem
              value="desktop"
              aria-label="Desktop width"
              className="h-tap gap-2 px-3 cursor-pointer rounded-(--radius-control) border border-border bg-surface-raised text-text-primary data-[state=on]:border-brand data-[state=on]:bg-brand-wash data-[state=on]:text-brand"
            >
              <MonitorIcon aria-hidden="true" className="size-4" />
              Desktop
            </ToggleGroupItem>
            <ToggleGroupItem
              value="mobile"
              aria-label="Phone width"
              className="h-tap gap-2 px-3 cursor-pointer rounded-(--radius-control) border border-border bg-surface-raised text-text-primary data-[state=on]:border-brand data-[state=on]:bg-brand-wash data-[state=on]:text-brand"
            >
              <SmartphoneIcon aria-hidden="true" className="size-4" />
              Mobile
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <ScrollArea className="@container min-h-0 flex-1">
          <div className="flex w-(--measure-message-preview-content) min-w-0 flex-col gap-4 p-4">
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-console-body font-medium text-text-primary">
                  {compiled.subject.trim() || "No subject yet"}
                </p>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="shrink-0">
                    Email details
                    <ChevronDownIcon
                      aria-hidden="true"
                      className={cn("size-4", detailsOpen && "rotate-180")}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="pt-3">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-(--radius-card) border border-border bg-surface-raised p-3 text-console-body">
                  <dt className="text-text-muted">From</dt>
                  <dd className="min-w-0 wrap-anywhere text-text-primary">
                    {fromName} &lt;{fromEmail}&gt;
                  </dd>
                  <dt className="text-text-muted">Sample recipient</dt>
                  <dd className="min-w-0 wrap-anywhere text-text-primary">
                    {recipient?.email ?? "No sample recipient"}
                  </dd>
                  <dt className="text-text-muted">Subject</dt>
                  <dd className="min-w-0 wrap-anywhere font-medium text-text-primary">
                    {compiled.subject.trim().length > 0
                      ? compiled.subject
                      : "No subject yet"}
                  </dd>
                </dl>
                {compiled.preheader.trim().length > 0 && (
                  <p className="pt-2 text-micro text-text-muted">
                    Inbox preview line: {compiled.preheader}
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {format === "text" ? (
              <pre
                aria-label="Plain-text email preview"
                className="whitespace-pre-wrap break-words rounded-(--radius-card) border border-border bg-surface-raised p-5 font-data text-console-body text-text-primary"
              >
                {rendered.text}
              </pre>
            ) : (
              <div
                className="overflow-x-auto rounded-(--radius-card) border border-border"
                role="region"
                aria-label="Email preview viewport"
                tabIndex={0}
                style={{ backgroundColor: EMAIL_THEME.pageBackground }}
              >
                <iframe
                  key={width}
                  title="Email preview"
                  sandbox="allow-same-origin"
                  srcDoc={rendered.html}
                  className={cn(
                    "mx-auto block max-w-none border-0",
                    width === "desktop"
                      ? "w-(--measure-email-desktop)"
                      : "w-(--measure-email-mobile)",
                  )}
                  style={{ height: frameHeight }}
                  onLoad={(event) => {
                    const frame = event.currentTarget;
                    const content = frame.contentDocument;
                    if (!content) return;
                    heightObserver.current?.disconnect();
                    const measure = () =>
                      setFrameHeight(
                        Math.ceil(content.body.getBoundingClientRect().height),
                      );
                    heightObserver.current = new ResizeObserver(measure);
                    heightObserver.current.observe(content.body);
                    measure();
                    content.addEventListener("click", (click) =>
                      click.preventDefault(),
                    );
                  }}
                />
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border p-4">
          {sendError === null && sentTo !== null && (
            <p role="status" className="text-console-body text-success">
              {sentTo}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="col-span-2 sm:mr-auto"
              onClick={() => {
                const html = format === "email";
                const url = URL.createObjectURL(
                  new Blob([html ? rendered.html : rendered.text], {
                    type: html
                      ? "text/html;charset=utf-8"
                      : "text/plain;charset=utf-8",
                  }),
                );
                const link = window.document.createElement("a");
                link.href = url;
                link.download = `${messageKey}.${html ? "html" : "txt"}`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              <DownloadIcon aria-hidden="true" className="size-4" />
              {format === "email" ? "Download HTML" : "Download text"}
            </Button>
            <SheetClose asChild>
              <Button type="button" variant="ghost" hoverEffect="sweep">
                Close
              </Button>
            </SheetClose>
            <SendTestDialog
              from={`${fromName} <${fromEmail}>`}
              subject={compiled.subject}
              sending={sending}
              sendError={sendError}
              onSendTest={onSendTest}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
