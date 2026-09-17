"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { TextAppearanceSettings } from "./text-appearance-settings";
import { MESSAGE_COLUMNS_LIMITS } from "@/lib/config/message-text";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ButtonAppearanceSettings } from "./button-appearance-settings";
import { Button } from "@/components/shared/button";
import { ConsoleIconAction } from "@/components/console/shared/console-icon-action";
import { DocumentProblems } from "@/components/console/manage/messages/document-problems";
import { HrefField } from "@/components/console/manage/messages/href-field";
import {
  InlineEditor,
  type VariableInserter,
} from "@/components/console/manage/messages/inline-editor";
import {
  BLOCK_META,
  blockLabel,
} from "@/components/console/manage/messages/message-document-model";
import { VariablePicker } from "@/components/console/manage/messages/variable-picker";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ImageUpload } from "@/components/console/manage/messages/image-upload";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  MESSAGE_DOCUMENT_LIMITS,
  type MessageVariable,
} from "@/lib/config/message-documents";
import {
  IMAGE_WIDTH,
  SPACER_HEIGHT,
  text,
  type AuthoredBlock,
  type DocumentProblem,
} from "@/lib/domain/email/document";
import { cn } from "@/lib/utils";

export interface BlockSettingsProps {
  block: AuthoredBlock;
  variables: readonly MessageVariable[];
  problems: readonly DocumentProblem[];
  disabled?: boolean;
  onChange: (block: AuthoredBlock) => void;
  onRemove: () => void;
  className?: string;
}

function numberFor(block: AuthoredBlock): string {
  if (block.kind === "spacer") return String(block.height);
  if (block.kind === "image") return String(block.width);
  return "";
}

function clampNumber(raw: string, min: number, max: number): number | null {
  const parsed = Number(raw.trim());
  if (raw.trim().length === 0 || !Number.isFinite(parsed)) return null;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function BlockSettings({
  block,
  variables,
  problems,
  disabled = false,
  onChange,
  onRemove,
  className,
}: BlockSettingsProps) {
  const instanceId = useId();
  const inserter = useRef<VariableInserter | null>(null);
  const [ready, setReady] = useState(false);
  const [numeric, setNumeric] = useState({
    id: block.id,
    value: numberFor(block),
    committed: numberFor(block),
  });

  if (numeric.id !== block.id || numeric.committed !== numberFor(block))
    setNumeric({
      id: block.id,
      value: numberFor(block),
      committed: numberFor(block),
    });

  const meta = BLOCK_META[block.kind];
  const fieldId = (suffix: string) =>
    `block-${instanceId}-${block.id}-${suffix}`;

  function activate(insert: VariableInserter) {
    inserter.current = insert;
    setReady(true);
  }

  function addRow() {
    if (
      block.kind !== "panel" ||
      block.rows.length >= MESSAGE_DOCUMENT_LIMITS.panelRowsMax
    )
      return;
    onChange({
      ...block,
      rows: [...block.rows, { label: [text("")], value: [text("")] }],
    });
  }

  function addItem() {
    if (
      block.kind !== "links" ||
      block.items.length >= MESSAGE_DOCUMENT_LIMITS.linkItemsMax
    )
      return;
    onChange({
      ...block,
      items: [...block.items, { label: [text("")], href: "" }],
    });
  }

  function setNumber(raw: string) {
    const bounds = block.kind === "spacer" ? SPACER_HEIGHT : IMAGE_WIDTH;
    const parsed = clampNumber(raw, bounds.min, bounds.max);
    setNumeric({
      id: block.id,
      value: raw,
      committed: parsed === null ? numberFor(block) : String(parsed),
    });

    if (block.kind === "spacer") {
      const height = clampNumber(raw, SPACER_HEIGHT.min, SPACER_HEIGHT.max);
      if (height !== null) onChange({ ...block, height });
      return;
    }

    if (block.kind === "image") {
      const width = clampNumber(raw, IMAGE_WIDTH.min, IMAGE_WIDTH.max);
      if (width !== null) onChange({ ...block, width });
    }
  }

  function fields(): ReactNode {
    switch (block.kind) {
      case "html":
        return (
          <Field>
            <FieldLabel htmlFor={fieldId("markup")}>Email HTML</FieldLabel>
            <Textarea
              id={fieldId("markup")}
              value={block.markup}
              disabled={disabled}
              maxLength={MESSAGE_DOCUMENT_LIMITS.htmlMax}
              className="min-h-console-panel font-data"
              placeholder="<p>Your custom email content</p>"
              onChange={(event) =>
                onChange({ ...block, markup: event.target.value })
              }
            />
            <FieldDescription>
              Use email HTML for custom content. Scripts, forms and unsafe
              styles are removed. Use text blocks for personal details.
            </FieldDescription>
          </Field>
        );
      case "band":
      case "quote":
        return (
          <Field>
            <FieldLabel>
              {block.kind === "quote" ? "Quotation" : "Highlighted message"}
            </FieldLabel>
            <InlineEditor
              ariaLabel={
                block.kind === "quote" ? "Quotation" : "Highlighted message"
              }
              value={block.content}
              variables={variables}
              multiline
              disabled={disabled}
              onActivate={activate}
              onChange={(content) => onChange({ ...block, content })}
            />
          </Field>
        );
      case "columns":
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={
                  disabled || block.columns.length >= MESSAGE_COLUMNS_LIMITS.max
                }
                onClick={() =>
                  onChange({
                    ...block,
                    columns: [...block.columns, [text("")]],
                  })
                }
              >
                <PlusIcon aria-hidden="true" className="size-4" /> Add column
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      disabled ||
                      block.columns.length <= MESSAGE_COLUMNS_LIMITS.min
                    }
                  >
                    Remove last column
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove the last column?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Its content will be removed from this block. You can undo
                      this change in the editor.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                      <Button variant="ghost" hoverEffect="sweep">
                        Keep column
                      </Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                      <Button
                        variant="destructive"
                        onClick={() =>
                          onChange({
                            ...block,
                            columns: block.columns.slice(0, -1),
                          })
                        }
                      >
                        Remove column
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            {block.columns.map((content, index) => (
              <Field key={index}>
                <FieldLabel>Column {index + 1}</FieldLabel>
                <InlineEditor
                  ariaLabel={`Column ${index + 1}`}
                  value={content}
                  variables={variables}
                  multiline
                  disabled={disabled}
                  onActivate={activate}
                  onChange={(next) =>
                    onChange({
                      ...block,
                      columns: block.columns.map((entry, position) =>
                        position === index ? next : entry,
                      ),
                    })
                  }
                />
              </Field>
            ))}
          </div>
        );
      case "hero":
        return (
          <>
            <HrefField
              id={fieldId("src")}
              label="Hero image address"
              value={block.src}
              variables={[]}
              disabled={disabled}
              onChange={(src) => onChange({ ...block, src })}
            />
            <Field>
              <FieldLabel htmlFor={fieldId("alt")}>
                Image description
              </FieldLabel>
              <Input
                id={fieldId("alt")}
                value={block.alt}
                disabled={disabled}
                maxLength={MESSAGE_DOCUMENT_LIMITS.altMax}
                onChange={(event) =>
                  onChange({ ...block, alt: event.target.value })
                }
              />
            </Field>
            <Field>
              <FieldLabel>Introduction</FieldLabel>
              <InlineEditor
                ariaLabel="Hero introduction"
                value={block.content}
                variables={variables}
                multiline
                disabled={disabled}
                onActivate={activate}
                onChange={(content) => onChange({ ...block, content })}
              />
            </Field>
          </>
        );
      case "video":
        return (
          <>
            <HrefField
              id={fieldId("href")}
              label="Video link"
              value={block.href}
              variables={[]}
              disabled={disabled}
              onChange={(href) => onChange({ ...block, href })}
            />
            <HrefField
              id={fieldId("src")}
              label="Thumbnail image address"
              value={block.src}
              variables={[]}
              disabled={disabled}
              onChange={(src) => onChange({ ...block, src })}
            />
            <Field>
              <FieldLabel htmlFor={fieldId("alt")}>
                Thumbnail description
              </FieldLabel>
              <Input
                id={fieldId("alt")}
                value={block.alt}
                disabled={disabled}
                maxLength={MESSAGE_DOCUMENT_LIMITS.altMax}
                onChange={(event) =>
                  onChange({ ...block, alt: event.target.value })
                }
              />
            </Field>
            <Field>
              <FieldLabel>Link label</FieldLabel>
              <InlineEditor
                linkable
                ariaLabel="Video link label"
                value={block.label}
                variables={variables}
                disabled={disabled}
                allowMarks={false}
                onActivate={activate}
                onChange={(label) => onChange({ ...block, label })}
              />
            </Field>
            <p className="text-micro text-text-muted">
              The thumbnail opens your video in the browser. Email apps do not
              play embedded video reliably.
            </p>
          </>
        );

      case "eyebrow":
      case "heading":
        return (
          <Field>
            <FieldLabel id={fieldId("content-label")}>
              {block.kind === "heading" ? "Heading" : "Label"}
            </FieldLabel>
            <InlineEditor
              linkable
              ariaLabel={block.kind === "heading" ? "Heading" : "Eyebrow label"}
              labelledBy={fieldId("content-label")}
              value={block.content}
              variables={variables}
              allowMarks={false}
              disabled={disabled}
              placeholder={
                block.kind === "heading" ? "You’re booked" : "Booking confirmed"
              }
              onActivate={activate}
              onChange={(content) => onChange({ ...block, content })}
            />
            <FieldDescription>{meta.hint}</FieldDescription>
          </Field>
        );

      case "note":
        return (
          <Field>
            <FieldLabel id={fieldId("content-label")}>Note</FieldLabel>
            <InlineEditor
              ariaLabel="Note"
              labelledBy={fieldId("content-label")}
              value={block.content}
              variables={variables}
              allowMarks={false}
              multiline
              disabled={disabled}
              placeholder="Small print the guest should still read."
              onActivate={activate}
              onChange={(content) => onChange({ ...block, content })}
            />
            <FieldDescription>{meta.hint}</FieldDescription>
          </Field>
        );

      case "lead":
        return (
          <Field>
            <FieldLabel id={fieldId("content-label")}>
              Opening sentence
            </FieldLabel>
            <InlineEditor
              ariaLabel="Opening sentence"
              labelledBy={fieldId("content-label")}
              value={block.content}
              variables={variables}
              multiline
              disabled={disabled}
              placeholder="Thank you for booking with WellPlace."
              onActivate={activate}
              onChange={(content) => onChange({ ...block, content })}
            />
            <FieldDescription>{meta.hint}</FieldDescription>
          </Field>
        );

      case "text":
        return (
          <>
            <Field>
              <FieldLabel id={fieldId("content-label")}>Paragraph</FieldLabel>
              <InlineEditor
                ariaLabel="Paragraph"
                labelledBy={fieldId("content-label")}
                value={block.content}
                variables={variables}
                multiline
                disabled={disabled}
                placeholder="Write the paragraph guests read."
                onActivate={activate}
                onChange={(content) => onChange({ ...block, content })}
              />
            </Field>
          </>
        );

      case "panel":
        return (
          <div className="flex min-w-0 flex-col gap-3">
            {block.rows.map((row, index) => (
              <div
                key={index}
                className="flex min-w-0 flex-col gap-2 rounded-(--radius-control) border border-border bg-surface-base p-3"
              >
                <div className="flex min-h-tap items-center justify-between gap-2">
                  <span className="text-console-label font-medium tracking-label text-text-muted uppercase">
                    Row {index + 1}
                  </span>
                  <ConsoleIconAction
                    label={`Remove row ${index + 1}`}
                    Icon={Trash2Icon}
                    variant="ghost"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...block,
                        rows: block.rows.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                  />
                </div>

                <InlineEditor
                  linkable
                  ariaLabel={`Row ${index + 1} label`}
                  value={row.label}
                  variables={variables}
                  allowMarks={false}
                  disabled={disabled}
                  placeholder="Reference"
                  onActivate={activate}
                  onChange={(label) =>
                    onChange({
                      ...block,
                      rows: block.rows.map((entry, position) =>
                        position === index ? { ...entry, label } : entry,
                      ),
                    })
                  }
                />

                <InlineEditor
                  linkable
                  ariaLabel={`Row ${index + 1} value`}
                  value={row.value}
                  variables={variables}
                  allowMarks={false}
                  disabled={disabled}
                  placeholder="Add the detail that fills this row"
                  onActivate={activate}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      rows: block.rows.map((entry, position) =>
                        position === index ? { ...entry, value } : entry,
                      ),
                    })
                  }
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              disabled={
                disabled ||
                block.rows.length >= MESSAGE_DOCUMENT_LIMITS.panelRowsMax
              }
              onClick={addRow}
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              Add a row
            </Button>
          </div>
        );

      case "file":
      case "button":
        return (
          <div className="grid min-w-0 gap-4 @sm:grid-cols-2">
            <Field>
              <FieldLabel id={fieldId("label-label")}>Button words</FieldLabel>
              <InlineEditor
                linkable
                ariaLabel="Button words"
                labelledBy={fieldId("label-label")}
                value={block.label}
                variables={variables}
                allowMarks={false}
                disabled={disabled}
                placeholder="View your receipt"
                onActivate={activate}
                onChange={(label) => onChange({ ...block, label })}
              />
              <FieldDescription>
                Say exactly what happens when it is tapped.
              </FieldDescription>
            </Field>

            <HrefField
              id={fieldId("href")}
              label="Where it goes"
              value={block.href}
              variables={variables}
              disabled={disabled}
              onChange={(href) => onChange({ ...block, href })}
            />
          </div>
        );

      case "links":
        return (
          <div className="flex min-w-0 flex-col gap-3">
            <Field>
              <FieldLabel id={fieldId("label-label")}>
                Label above the links
              </FieldLabel>
              <InlineEditor
                linkable
                ariaLabel="Links label"
                labelledBy={fieldId("label-label")}
                value={block.label}
                variables={variables}
                allowMarks={false}
                disabled={disabled}
                placeholder="Useful links"
                onActivate={activate}
                onChange={(label) => onChange({ ...block, label })}
              />
            </Field>

            {block.items.map((item, index) => (
              <div
                key={index}
                className="flex min-w-0 flex-col gap-2 rounded-(--radius-control) border border-border bg-surface-base p-3"
              >
                <div className="flex min-h-tap items-center justify-between gap-2">
                  <span className="text-console-label font-medium tracking-label text-text-muted uppercase">
                    Link {index + 1}
                  </span>
                  <ConsoleIconAction
                    label={`Remove link ${index + 1}`}
                    Icon={Trash2Icon}
                    variant="ghost"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...block,
                        items: block.items.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                  />
                </div>

                <InlineEditor
                  linkable
                  ariaLabel={`Link ${index + 1} words`}
                  value={item.label}
                  variables={variables}
                  allowMarks={false}
                  disabled={disabled}
                  placeholder="Directions and parking"
                  onActivate={activate}
                  onChange={(label) =>
                    onChange({
                      ...block,
                      items: block.items.map((entry, position) =>
                        position === index ? { ...entry, label } : entry,
                      ),
                    })
                  }
                />

                <HrefField
                  id={fieldId(`item-${index}`)}
                  label="Where it goes"
                  value={item.href}
                  variables={variables}
                  disabled={disabled}
                  onChange={(href) =>
                    onChange({
                      ...block,
                      items: block.items.map((entry, position) =>
                        position === index ? { ...entry, href } : entry,
                      ),
                    })
                  }
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              disabled={
                disabled ||
                block.items.length >= MESSAGE_DOCUMENT_LIMITS.linkItemsMax
              }
              onClick={addItem}
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              Add a link
            </Button>
          </div>
        );

      case "divider":
        return (
          <p className="text-console-body text-text-secondary">
            A hairline runs the full width of the email. It has nothing to fill
            in.
          </p>
        );

      case "spacer":
        return (
          <Field>
            <FieldLabel htmlFor={fieldId("height")}>Height</FieldLabel>
            <Input
              id={fieldId("height")}
              type="number"
              inputMode="numeric"
              min={SPACER_HEIGHT.min}
              max={SPACER_HEIGHT.max}
              step={SPACER_HEIGHT.step}
              disabled={disabled}
              value={numeric.value}
              onChange={(event) => setNumber(event.target.value)}
              onBlur={() =>
                setNumeric({
                  id: block.id,
                  value: numberFor(block),
                  committed: numberFor(block),
                })
              }
            />
            <FieldDescription>
              Between {SPACER_HEIGHT.min} and {SPACER_HEIGHT.max} pixels.
            </FieldDescription>
          </Field>
        );

      case "image":
        return (
          <>
            <HrefField
              id={fieldId("src")}
              label="Picture address"
              value={block.src}
              variables={variables}
              disabled={disabled}
              placeholder="https://wellplace.example/renderings/suite.jpg"
              description="Email clients only show pictures served over https."
              onChange={(src) => onChange({ ...block, src })}
            />

            <Field>
              <FieldLabel htmlFor={fieldId("alt")}>Description</FieldLabel>
              <Input
                id={fieldId("alt")}
                value={block.alt}
                disabled={disabled}
                maxLength={MESSAGE_DOCUMENT_LIMITS.altMax}
                placeholder="A private suite with warm timber walls"
                onChange={(event) =>
                  onChange({ ...block, alt: event.target.value })
                }
              />
              <FieldDescription>
                Read aloud, and shown when an email hides pictures.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor={fieldId("width")}>Width</FieldLabel>
              <Input
                id={fieldId("width")}
                type="number"
                inputMode="numeric"
                min={IMAGE_WIDTH.min}
                max={IMAGE_WIDTH.max}
                disabled={disabled}
                value={numeric.value}
                onChange={(event) => setNumber(event.target.value)}
                onBlur={() =>
                  setNumeric({
                    id: block.id,
                    value: numberFor(block),
                    committed: numberFor(block),
                  })
                }
              />
              <FieldDescription>
                Between {IMAGE_WIDTH.min} and {IMAGE_WIDTH.max} pixels wide.
              </FieldDescription>
            </Field>
          </>
        );
    }
  }

  const takesVariables =
    block.kind !== "divider" &&
    block.kind !== "spacer" &&
    block.kind !== "html";

  return (
    <div className={cn("@container flex min-w-0 flex-col gap-4", className)}>
      <div className="flex min-h-tap flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-console-body font-medium text-text-primary">
          <meta.Icon
            aria-hidden="true"
            className="size-4 shrink-0 text-text-muted"
          />
          {blockLabel(block)}
        </span>
        <ConsoleIconAction
          label={`Delete this ${blockLabel(block).toLowerCase()} block`}
          Icon={Trash2Icon}
          variant="ghost"
          disabled={disabled}
          onClick={onRemove}
        />
      </div>

      {(block.kind === "image" ||
        block.kind === "hero" ||
        block.kind === "video") && (
        <ImageUpload
          disabled={disabled}
          onUploaded={(src) => onChange({ ...block, src })}
        />
      )}
      {fields()}
      {(block.kind === "text" ||
        block.kind === "heading" ||
        block.kind === "eyebrow" ||
        block.kind === "lead" ||
        block.kind === "note") && (
        <TextAppearanceSettings
          block={block}
          disabled={disabled}
          onChange={(appearance) => onChange({ ...block, appearance })}
        />
      )}
      {block.kind === "button" && (
        <ButtonAppearanceSettings
          appearance={block.appearance}
          disabled={disabled}
          onChange={(appearance) => onChange({ ...block, appearance })}
        />
      )}

      <DocumentProblems
        problems={problems}
        labelFor={() => blockLabel(block)}
        variant="inline"
      />

      {takesVariables && (
        <VariablePicker
          variables={variables}
          disabled={disabled || !ready}
          label="Insert variable"
          onInsert={(name) => inserter.current?.(name)}
        />
      )}
    </div>
  );
}
