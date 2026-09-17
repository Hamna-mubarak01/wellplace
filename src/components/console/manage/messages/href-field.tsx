"use client";

import { LockKeyholeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/shared/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  MESSAGE_DOCUMENT_LIMITS,
  type MessageVariable,
} from "@/lib/config/message-documents";
import {
  isUsableHref,
  variableToken,
  variableInToken,
} from "@/lib/domain/email/document";
import { cn } from "@/lib/utils";

export interface HrefFieldProps {
  id: string;
  label: string;
  value: string;
  variables: readonly MessageVariable[];
  onChange: (href: string) => void;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

function addressVariables(
  variables: readonly MessageVariable[],
): readonly MessageVariable[] {
  return variables.filter(
    (entry) =>
      entry.name.endsWith("_url") || entry.sample.startsWith("https://"),
  );
}

export function HrefField({
  id,
  label,
  value,
  variables,
  onChange,
  placeholder = "https://wellplace.example/book",
  description,
  disabled = false,
  className,
}: HrefFieldProps) {
  const offered = addressVariables(variables);
  const token = variableInToken(value);
  const written = value.trim().length > 0;
  const broken = written && !isUsableHref(value);

  return (
    <Field
      data-invalid={broken || undefined}
      className={cn("min-w-0", className)}
    >
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {token !== null ? (
        <div
          id={id}
          className="flex min-h-tap items-center justify-between gap-2 rounded-(--radius-control) border border-border-interactive bg-surface-raised pl-3"
        >
          <span className="flex min-w-0 items-center gap-2 text-console-body text-text-primary">
            <LockKeyholeIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">
              {variables.find((entry) => entry.name === token)?.label ?? token}
            </span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove variable link"
            disabled={disabled}
            onClick={() => onChange("")}
          >
            <XIcon aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : (
        <Input
          id={id}
          value={value}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          maxLength={MESSAGE_DOCUMENT_LIMITS.hrefMax}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {offered.length > 0 && (
        <div className="flex min-w-0 flex-wrap gap-2">
          {offered.map((entry) => (
            <Button
              key={entry.name}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onChange(variableToken(entry.name))}
            >
              Use {entry.label.toLowerCase()}
            </Button>
          ))}
        </div>
      )}

      {description !== undefined && (
        <FieldDescription>{description}</FieldDescription>
      )}

      {broken && (
        <FieldError>
          That address will not open. Use an https:// address, a mailto:
          address, or one of the guest details above.
        </FieldError>
      )}
    </Field>
  );
}
