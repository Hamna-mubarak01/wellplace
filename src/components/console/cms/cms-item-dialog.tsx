"use client";

import { useId, useState } from "react";
import { Trash2Icon } from "lucide-react";

import { CmsIconField } from "@/components/console/cms/cms-icon-field";
import {
  CmsUploadButton,
  MediaPreview,
} from "@/components/console/cms/cms-media-picker";
import { Button } from "@/components/shared/button";
import { SocialIcon } from "@/components/shared/social-icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  CmsLeafFieldSpec,
  CmsRepeaterItem,
  CmsRepeaterValue,
} from "@/lib/config/cms/types";
import { CMS_LIMITS } from "@/lib/config/cms/limits";
import { cmsFieldError } from "@/lib/validation/cms-values";
import { ActionError } from "@/components/shared/action-error";

const LABEL_CLASS =
  "text-console-label font-medium tracking-label text-text-secondary uppercase";
const CONTROL_CLASS =
  "h-control w-full rounded-(--radius-control) border-border-interactive bg-surface-base px-3 text-console-body";

export function CmsItemDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  slug,
  value,
  onSave,
  confirmLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  fields: readonly CmsLeafFieldSpec[];
  slug: string;
  value: CmsRepeaterItem;
  onSave: (next: CmsRepeaterItem) => void;
  confirmLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-dialog-max-h min-w-0 flex-col gap-3 overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {open && (
          <ItemForm
            key={JSON.stringify(value)}
            fields={fields}
            slug={slug}
            initial={value}
            confirmLabel={confirmLabel}
            onCancel={() => onOpenChange(false)}
            onSave={(next) => {
              onSave(next);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ItemForm({
  fields,
  slug,
  initial,
  confirmLabel,
  onCancel,
  onSave,
}: {
  fields: readonly CmsLeafFieldSpec[];
  slug: string;
  initial: CmsRepeaterItem;
  confirmLabel: string;
  onCancel: () => void;
  onSave: (next: CmsRepeaterItem) => void;
}) {
  const [draft, setDraft] = useState<Record<string, CmsRepeaterValue>>(() => ({
    ...initial,
  }));

  const groups: readonly string[] = [
    ...new Set(
      fields
        .map((field) => field.group)
        .filter((group): group is string => !!group),
    ),
  ];
  const [group, setGroup] = useState(groups[0] ?? "");

  function isMissing(field: CmsLeafFieldSpec): boolean {
    if (field.required === false) return false;
    if (
      field.kind === "select" ||
      field.kind === "icon" ||
      field.kind === "toggle"
    ) {
      return false;
    }
    const value = draft[field.key];
    return typeof value !== "string" || value.trim().length === 0;
  }

  const missing = fields.filter(isMissing);
  const validationError = fields.map((field) => cmsFieldError(field, draft[field.key])).find(Boolean);

  function renderField(field: CmsLeafFieldSpec) {
    return (
      <ItemField
        key={field.key}
        field={field}
        slug={slug}
        value={
          draft[field.key] ??
          (field.kind === "toggle" ? field.defaultValue : "")
        }
        onChange={(next) =>
          setDraft((current) => ({ ...current, [field.key]: next }))
        }
      />
    );
  }

  return (
    <>
      {groups.length > 1 ? (
        <Tabs
          value={group}
          onValueChange={setGroup}
          className="min-h-0 min-w-0 gap-2"
        >
          <TabsList className="h-auto w-full shrink-0 flex-wrap">
            {groups.map((name) => {
              const incomplete = fields.some(
                (field) => field.group === name && isMissing(field),
              );
              return (
                <TabsTrigger key={name} value={name} className="flex-1 gap-1.5">
                  {name}
                  {incomplete && (
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-warning"
                    />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {groups.map((name) => (
            <TabsContent
              key={name}
              value={name}
              className="mt-0 flex min-h-0 min-w-0 flex-col"
            >
              <ScrollArea className="h-dialog-scroll-h min-h-0 min-w-0">
                <div className="flex flex-col gap-4 pr-3">
                  {fields
                    .filter((field) => field.group === name)
                    .map(renderField)}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <ScrollArea className="h-dialog-scroll-h min-h-0 min-w-0">
          <div className="flex flex-col gap-4 pr-3">
            {fields.map(renderField)}
          </div>
        </ScrollArea>
      )}

      {missing.length > 0 && (
        <p className="max-h-20 shrink-0 overflow-y-auto text-micro text-text-muted">
          Still needed:{" "}
          {missing
            .map((field) =>
              field.group
                ? `${field.group} ${field.label.toLowerCase()}`
                : field.label,
            )
            .join(", ")}
          .
        </p>
      )}

      {validationError && <ActionError message={validationError} />}
      <DialogFooter className="shrink-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          tone="brand"
          disabled={missing.length > 0 || !!validationError}
          onClick={() => onSave(draft)}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

function ItemField({
  field,
  slug,
  value,
  onChange,
}: {
  field: CmsLeafFieldSpec;
  slug: string;
  value: CmsRepeaterValue;
  onChange: (next: CmsRepeaterValue) => void;
}) {
  const id = useId();
  const asText = typeof value === "string" ? value : "";

  if (field.kind === "toggle") {
    const checked = value === true;
    return (
      <Field className="min-w-0 gap-1.5">
        <FieldLabel htmlFor={id} className={LABEL_CLASS}>
          {field.label}
        </FieldLabel>
        <div className="flex min-h-tap items-center gap-3">
          <ConsoleSwitch id={id} checked={checked} onCheckedChange={onChange} />
          <span className="text-console-body text-text-secondary">
            {checked
              ? (field.onLabel ?? "Shown")
              : (field.offLabel ?? "Hidden")}
          </span>
        </div>
        {field.help && (
          <p className="text-micro text-text-muted">{field.help}</p>
        )}
      </Field>
    );
  }

  if (field.kind === "lines") {
    const entries = asText.split("\n").filter((line) => line.trim());
    return (
      <Field className="min-w-0 gap-1.5">
        <FieldLabel htmlFor={id} className={LABEL_CLASS}>
          {field.label}
        </FieldLabel>
        <Textarea
          id={id}
          maxLength={CMS_LIMITS.text}
          value={asText}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-20 resize-y rounded-(--radius-control) border-border-interactive bg-surface-base px-3 py-2 text-console-body"
        />
        <p className="text-micro text-text-muted">
          {field.help ??
            `One ${field.itemLabel.toLowerCase()} per line, up to ${field.maxItems}.`}{" "}
          {entries.length}/{field.maxItems}
        </p>
      </Field>
    );
  }

  return (
    <Field className="min-w-0 gap-1.5">
      <FieldLabel htmlFor={id} className={LABEL_CLASS}>
        {field.label}
      </FieldLabel>

      {field.kind === "icon" ? (
        <CmsIconField
          value={asText || field.defaultValue}
          onChange={onChange}
          labelledBy={id}
        />
      ) : field.kind === "image" ? (
        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center">
          <MediaPreview url={asText} />
          <div className="flex flex-wrap gap-2">
            <CmsUploadButton
              slug={slug}
              label={field.label}
              onUploaded={(next) => onChange(next.url)}
            >
              {asText ? "Replace" : "Upload"}
            </CmsUploadButton>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange("")}
              >
                <Trash2Icon aria-hidden="true" className="size-4" />
                Remove
              </Button>
            )}
          </div>
        </div>
      ) : field.kind === "select" ? (
        <Select value={asText || field.defaultValue} onValueChange={onChange}>
          <SelectTrigger
            id={id}
            className="h-control data-[size=default]:h-control min-w-0 w-full rounded-(--radius-control) bg-surface-base text-console-body [&>[data-slot=select-value]]:min-w-0"
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
      ) : field.kind === "textarea" ? (
        <Textarea
          id={id}
          maxLength={field.maxLength ?? CMS_LIMITS.text}
          value={asText}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-24 resize-y rounded-(--radius-control) border-border-interactive bg-surface-base px-3 py-2 text-console-body"
        />
      ) : (
        <Input
          id={id}
          maxLength={field.maxLength ?? CMS_LIMITS.text}
          value={asText}
          onChange={(event) => onChange(event.target.value)}
          className={CONTROL_CLASS}
        />
      )}

      {field.help && <p className="text-micro text-text-muted">{field.help}</p>}
    </Field>
  );
}
