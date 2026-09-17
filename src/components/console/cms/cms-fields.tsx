"use client";

import { SocialIcon } from "@/components/shared/social-icon";

import { useId, useState } from "react";
import {
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";

import {
  CmsMediaPicker,
  CmsUploadButton,
  MediaPreview,
} from "@/components/console/cms/cms-media-picker";
import { CmsIconField } from "@/components/console/cms/cms-icon-field";
import { CmsItemDialog } from "@/components/console/cms/cms-item-dialog";
import { useReorder } from "@/components/console/cms/use-reorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/shared/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  CmsFieldSpec,
  CmsFieldValue,
  CmsMediaItem,
  CmsRepeaterItem,
} from "@/lib/config/cms/types";
import { CMS_LIMITS } from "@/lib/config/cms/limits";

const LABEL_CLASS =
  "text-console-label font-medium tracking-label text-text-secondary uppercase";
const CONTROL_CLASS =
  "h-control w-full rounded-(--radius-control) border-border-interactive bg-surface-base px-3 text-console-body";

function isChanged(
  value: CmsFieldValue,
  baseline: CmsFieldValue | undefined,
): boolean {
  if (baseline === undefined) return false;
  return JSON.stringify(value) !== JSON.stringify(baseline);
}

function fileNameOf(url: string): string {
  const withoutQuery = url.split("?")[0] ?? url;
  const last = withoutQuery.split("/").pop() ?? "";
  return decodeURIComponent(last) || "Uploaded file";
}

function itemText(item: CmsRepeaterItem, key: string | undefined): string {
  if (!key) return "";
  const value = item[key];
  return typeof value === "string" ? value : "";
}

function ResetButton({
  onReset,
  label,
}: {
  onReset: () => void;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onReset}
          aria-label={`Undo unpublished changes to ${label}`}
        >
          <RotateCcwIcon aria-hidden="true" className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Undo — back to the published text</TooltipContent>
    </Tooltip>
  );
}

function FieldFrame({
  id,
  label,
  help,
  changed,
  onReset,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  changed: boolean;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <Field className="@container/cms-field min-w-0 gap-1.5">
      <div className="flex min-h-tap min-w-0 items-center justify-between gap-3">
        <FieldLabel htmlFor={id} className={`${LABEL_CLASS} min-w-0`}>
          {label}
        </FieldLabel>
        <div className="flex shrink-0 items-center gap-1.5">
          {changed && (
            <Badge variant="secondary" className="text-micro font-medium">
              Unpublished
            </Badge>
          )}
          {changed && <ResetButton onReset={onReset} label={label} />}
        </div>
      </div>
      {children}
      {help && <p className="text-micro text-text-muted">{help}</p>}
    </Field>
  );
}

export function CmsTextInput({
  field,
  value,
  baseline,
  onChange,
  onReset,
}: {
  field: Extract<CmsFieldSpec, { kind: "text" | "textarea" }>;
  value: string;
  baseline: string | undefined;
  onChange: (next: string) => void;
  onReset: () => void;
}) {
  const id = useId();
  const changed = isChanged(value, baseline);

  return (
    <FieldFrame
      id={id}
      label={field.label}
      help={field.help}
      changed={changed}
      onReset={onReset}
    >
      {field.kind === "textarea" ? (
        <Textarea
          id={id}
          maxLength={field.maxLength ?? CMS_LIMITS.text}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-24 resize-y rounded-(--radius-control) border-border-interactive bg-surface-base px-3 py-2 text-console-body"
        />
      ) : (
        <Input
          id={id}
          maxLength={field.maxLength ?? CMS_LIMITS.text}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={CONTROL_CLASS}
        />
      )}
    </FieldFrame>
  );
}

export function CmsImageInput({
  field,
  value,
  baseline,
  slug,
  onChange,
  onReset,
}: {
  field: Extract<CmsFieldSpec, { kind: "image" }>;
  value: string;
  baseline: string | undefined;
  slug: string;
  onChange: (next: string) => void;
  onReset: () => void;
}) {
  const id = useId();
  const changed = isChanged(value, baseline);

  return (
    <FieldFrame
      id={id}
      label={field.label}
      help={field.recommended ?? field.help}
      changed={changed}
      onReset={onReset}
    >
      <CmsMediaPicker
        slug={slug}
        previewFit={field.previewFit}
        faviconOnly={field.faviconOnly}
        url={value}
        label={field.label}
        onUploaded={(next) => onChange(next.url)}
        onClear={() => onChange("")}
      />
    </FieldFrame>
  );
}

export function CmsMediaInput({
  field,
  value,
  baseline,
  slug,
  onChange,
  onReset,
}: {
  field: Extract<CmsFieldSpec, { kind: "media" }>;
  value: readonly CmsMediaItem[];
  baseline: readonly CmsMediaItem[] | undefined;
  slug: string;
  onChange: (next: readonly CmsMediaItem[]) => void;
  onReset: () => void;
}) {
  const id = useId();
  const changed = isChanged(value, baseline);
  const atLimit = value.length >= field.maxItems;
  const reorder = useReorder(value, onChange);

  function update(index: number, patch: Partial<CmsMediaItem>) {
    onChange(
      value.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <FieldFrame
      id={id}
      label={field.label}
      help={field.help}
      changed={changed}
      onReset={onReset}
    >
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <p className="font-data text-micro tracking-label text-text-muted uppercase">
            {value.length}/{field.maxItems} items
          </p>
          {!atLimit && (
            <CmsUploadButton
              slug={slug}
              label={field.label}
              onUploaded={(next) =>
                onChange([...value, { kind: next.kind, url: next.url }])
              }
            >
              Add media
            </CmsUploadButton>
          )}
        </div>

        {value.length === 0 ? (
          <p className="rounded-(--radius-control) border border-dashed border-border bg-surface-sunken px-4 py-6 text-center text-console-body text-text-muted">
            No media yet — the built-in renderings are used.
          </p>
        ) : (
          <ul className="grid min-w-0 grid-cols-1 gap-2.5 @3xl/cms-field:grid-cols-2 @6xl/cms-field:grid-cols-3">
            {value.map((item, index) => (
              <li
                key={`${item.url}-${index}`}
                {...reorder.itemProps(index)}
                className="flex min-w-0 flex-wrap items-center gap-2.5 rounded-(--radius-control) border border-border bg-surface-base p-2.5 transition-colors data-[dragging]:opacity-50 data-[drop-target]:border-brand"
              >
                <span {...reorder.handleProps(index, `Item ${index + 1}`)}>
                  <GripVerticalIcon aria-hidden="true" className="size-4" />
                </span>

                <MediaPreview
                  url={item.url}
                  kind={item.kind}
                  className="aspect-square w-14 shrink-0"
                />

                <div className="min-w-0 flex-1 basis-24">
                  <p className="truncate text-console-body font-medium text-text-primary">
                    {fileNameOf(item.url)}
                  </p>
                  <p className="text-micro text-text-muted">
                    {item.kind === "video" ? "Video" : "Image"} {index + 1}
                  </p>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-0.5">
                  <CmsUploadButton
                    slug={slug}
                    label={`item ${index + 1}`}
                    onUploaded={(next) => update(index, next)}
                    iconOnly
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() =>
                      onChange(value.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2Icon aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FieldFrame>
  );
}

export function CmsRepeaterInput({
  field,
  value,
  baseline,
  slug,
  onChange,
  onReset,
}: {
  field: Extract<CmsFieldSpec, { kind: "repeater" }>;
  value: readonly CmsRepeaterItem[];
  baseline: readonly CmsRepeaterItem[] | undefined;
  slug: string;
  onChange: (next: readonly CmsRepeaterItem[]) => void;
  onReset: () => void;
}) {
  const id = useId();
  const changed = isChanged(value, baseline);
  const atLimit = value.length >= field.maxItems;
  const reorder = useReorder(value, onChange);
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const imageKey = field.fields.find((entry) => entry.kind === "image")?.key;
  const socialIconField = field.fields.find(
    (entry) => entry.kind === "select" && entry.iconSet === "social",
  );
  const toggleField = field.fields.find((entry) => entry.kind === "toggle");
  const labelled = field.fields.filter(
    (entry) => entry.kind === "text" || entry.kind === "select",
  );
  const titleKey =
    labelled.find((entry) => /title|question|label|name|page/i.test(entry.key))
      ?.key ?? labelled[0]?.key;
  const subKey = field.fields.find(
    (entry) =>
      entry.key !== titleKey &&
      entry.key !== imageKey &&
      entry.kind !== "select" &&
      entry.kind !== "toggle" &&
      entry.kind !== "icon",
  )?.key;

  function optionLabel(key: string | undefined, raw: string): string {
    const spec = field.fields.find((entry) => entry.key === key);
    if (!spec || spec.kind !== "select") return raw;
    return spec.options.find((option) => option.value === raw)?.label ?? raw;
  }

  function emptyItem(): CmsRepeaterItem {
    return Object.fromEntries(
      field.fields.map((entry) => {
        if (entry.kind === "toggle") return [entry.key, entry.defaultValue];
        if (entry.kind === "select" || entry.kind === "icon") {
          return [entry.key, entry.defaultValue];
        }
        return [entry.key, ""];
      }),
    );
  }

  return (
    <FieldFrame
      id={id}
      label={field.label}
      help={field.help}
      changed={changed}
      onReset={onReset}
    >
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <p className="font-data text-micro tracking-label text-text-muted uppercase">
            {value.length}/{field.maxItems}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={atLimit}
            onClick={() => setAdding(true)}
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            Add {field.itemLabel.toLowerCase()}
          </Button>
        </div>

        {value.length === 0 ? (
          <p className="rounded-(--radius-control) border border-dashed border-border bg-surface-sunken px-4 py-6 text-center text-console-body text-text-muted">
            No {field.itemLabel.toLowerCase()}s yet.
          </p>
        ) : (
          <ul className="grid min-w-0 grid-cols-1 gap-2.5 @3xl/cms-field:grid-cols-2 @6xl/cms-field:grid-cols-3">
            {value.map((item, index) => (
              <li
                key={index}
                {...reorder.itemProps(index)}
                className="flex min-w-0 flex-wrap items-center gap-2.5 rounded-(--radius-control) border border-border bg-surface-base p-2.5 transition-colors data-[dragging]:opacity-50 data-[drop-target]:border-brand"
              >
                <span
                  {...reorder.handleProps(
                    index,
                    `${field.itemLabel} ${index + 1}`,
                  )}
                >
                  <GripVerticalIcon aria-hidden="true" className="size-4" />
                </span>

                {socialIconField && (
                  <span className="grid size-tap shrink-0 place-items-center rounded-(--radius-control) bg-surface-sunken text-text-secondary">
                    <SocialIcon name={itemText(item, socialIconField.key)} />
                  </span>
                )}
                {imageKey && (
                  <MediaPreview
                    url={itemText(item, imageKey)}
                    className="aspect-square w-14 shrink-0"
                  />
                )}

                <div className="min-w-0 flex-1 basis-24">
                  <p className="truncate text-console-body font-medium text-text-primary">
                    {optionLabel(titleKey, itemText(item, titleKey)) ||
                      `${field.itemLabel} ${index + 1}`}
                  </p>
                  {subKey && itemText(item, subKey) && (
                    <p className="truncate text-micro text-text-muted">
                      {itemText(item, subKey)}
                    </p>
                  )}
                </div>

                {toggleField && (
                  <Badge
                    variant={
                      item[toggleField.key] === true ? "default" : "secondary"
                    }
                    className="shrink-0 text-micro font-medium"
                  >
                    {item[toggleField.key] === true
                      ? (toggleField.onLabel ?? "On")
                      : (toggleField.offLabel ?? "Off")}
                  </Badge>
                )}

                <div className="ml-auto flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${field.itemLabel} ${index + 1}`}
                    onClick={() => setEditing(index)}
                  >
                    <PencilIcon aria-hidden="true" className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${field.itemLabel} ${index + 1}`}
                    onClick={() =>
                      onChange(value.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2Icon aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CmsItemDialog
        open={adding}
        onOpenChange={setAdding}
        title={`Add ${field.itemLabel.toLowerCase()}`}
        description={
          field.help ?? "Fill in everything below, then add it to the list."
        }
        fields={field.fields}
        slug={slug}
        value={emptyItem()}
        confirmLabel={`Add ${field.itemLabel.toLowerCase()}`}
        onSave={(next) => onChange([...value, next])}
      />

      <CmsItemDialog
        open={editing !== null}
        onOpenChange={(next: boolean) => {
          if (!next) setEditing(null);
        }}
        title={`Edit ${field.itemLabel.toLowerCase()}`}
        description={field.help ?? "Every field for this item is here."}
        fields={field.fields}
        slug={slug}
        value={editing === null ? emptyItem() : (value[editing] ?? emptyItem())}
        confirmLabel="Save"
        onSave={(next) =>
          onChange(value.map((item, i) => (i === editing ? next : item)))
        }
      />
    </FieldFrame>
  );
}

export function CmsIconInput({
  field,
  value,
  baseline,
  onChange,
  onReset,
}: {
  field: Extract<CmsFieldSpec, { kind: "icon" }>;
  value: string;
  baseline: string | undefined;
  onChange: (next: string) => void;
  onReset: () => void;
}) {
  const id = useId();

  return (
    <FieldFrame
      id={id}
      label={field.label}
      help={field.help}
      changed={isChanged(value, baseline)}
      onReset={onReset}
    >
      <CmsIconField
        value={value || field.defaultValue}
        onChange={onChange}
        labelledBy={id}
      />
    </FieldFrame>
  );
}

export function CmsListInput({
  field,
  value,
  baseline,
  onChange,
  onReset,
}: {
  field: Extract<CmsFieldSpec, { kind: "list" }>;
  value: readonly string[];
  baseline: readonly string[] | undefined;
  onChange: (next: readonly string[]) => void;
  onReset: () => void;
}) {
  const id = useId();
  const changed = isChanged(value, baseline);
  const atLimit = value.length >= field.maxItems;
  const reorder = useReorder(value, onChange);

  return (
    <FieldFrame
      id={id}
      label={field.label}
      help={field.help}
      changed={changed}
      onReset={onReset}
    >
      <div className="flex flex-col gap-2">
        {value.map((entry, index) => (
          <div
            key={index}
            {...reorder.itemProps(index)}
            className="flex items-center gap-1.5 rounded-(--radius-control) transition-colors data-[dragging]:opacity-50 data-[drop-target]:bg-surface-hover"
          >
            <span
              {...reorder.handleProps(index, `${field.itemLabel} ${index + 1}`)}
            >
              <GripVerticalIcon aria-hidden="true" className="size-4" />
            </span>
            <Input
              maxLength={CMS_LIMITS.listItem}
              value={entry}
              aria-label={`${field.itemLabel} ${index + 1}`}
              onChange={(event) =>
                onChange(
                  value.map((item, i) =>
                    i === index ? event.target.value : item,
                  ),
                )
              }
              className={CONTROL_CLASS}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${field.itemLabel} ${index + 1}`}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              <Trash2Icon aria-hidden="true" className="size-4" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={atLimit}
          onClick={() => onChange([...value, ""])}
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          Add {field.itemLabel.toLowerCase()}
        </Button>
      </div>
    </FieldFrame>
  );
}

export function CmsLinesInput({
  field,
  value,
  baseline,
  onChange,
  onReset,
}: {
  field: Extract<CmsFieldSpec, { kind: "lines" }>;
  value: string;
  baseline: string | undefined;
  onChange: (next: string) => void;
  onReset: () => void;
}) {
  const id = useId();
  const entries = value.split("\n").filter((line) => line.trim());

  return (
    <FieldFrame
      id={id}
      label={field.label}
      help={
        field.help ??
        `One ${field.itemLabel.toLowerCase()} per line, up to ${field.maxItems}.`
      }
      changed={isChanged(value, baseline)}
      onReset={onReset}
    >
      <Textarea
        id={id}
        maxLength={CMS_LIMITS.text}
        aria-invalid={entries.length > field.maxItems}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 resize-y rounded-(--radius-control) border-border-interactive bg-surface-base px-3 py-2 text-console-body"
      />
      <p className="font-data text-micro tracking-label text-text-muted uppercase">
        {entries.length}/{field.maxItems} {field.itemLabel.toLowerCase()}s
      </p>
    </FieldFrame>
  );
}

export function CmsSelectInput({
  field,
  value,
  baseline,
  onChange,
  onReset,
}: {
  field: Extract<CmsFieldSpec, { kind: "select" }>;
  value: string;
  baseline: string | undefined;
  onChange: (next: string) => void;
  onReset: () => void;
}) {
  const id = useId();

  return (
    <FieldFrame
      id={id}
      label={field.label}
      help={field.help}
      changed={isChanged(value, baseline)}
      onReset={onReset}
    >
      <Select value={value || field.defaultValue} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className="h-control data-[size=default]:h-control w-full rounded-(--radius-control) bg-surface-base text-console-body"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {field.iconSet === "social" && (
                <SocialIcon name={option.value} className="size-4" />
              )}
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldFrame>
  );
}

export function CmsToggleInput({
  field,
  value,
  baseline,
  onChange,
  onReset,
}: {
  field: Extract<CmsFieldSpec, { kind: "toggle" }>;
  value: boolean;
  baseline: boolean | undefined;
  onChange: (next: boolean) => void;
  onReset: () => void;
}) {
  const id = useId();

  return (
    <FieldFrame
      id={id}
      label={field.label}
      help={field.help}
      changed={isChanged(value, baseline)}
      onReset={onReset}
    >
      <div className="flex min-h-tap items-center gap-3">
        <ConsoleSwitch id={id} checked={value} onCheckedChange={onChange} />
        <span className="text-console-body text-text-secondary">
          {value ? (field.onLabel ?? "Shown") : (field.offLabel ?? "Hidden")}
        </span>
      </div>
    </FieldFrame>
  );
}
