"use client";

import { COUNTER_VISIBLE_AT_REMAINING, REASON_MAX_LENGTH } from "@/lib/config/console-limits";
import { Field, FieldLabel } from "@/components/ui/field";
import { ActionError } from "@/components/shared/action-error";
import { Textarea } from "@/components/ui/textarea";

export interface ReasonFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  label?: string;
  maxLength?: number;
}

export function ReasonField({
  id,
  value,
  onChange,
  error,
  disabled = false,
  label = "Reason",
  maxLength = REASON_MAX_LENGTH,
}: ReasonFieldProps) {
  const remaining = maxLength - value.length;
  const counterId = `${id}-remaining`;
  return (
    <Field data-invalid={error ? true : undefined}>
      {error && <ActionError id={`${id}-error`} message={error} />}
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
        disabled={disabled}
        rows={2}
        maxLength={maxLength}
        className="text-console-body"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[error ? `${id}-error` : null, remaining <= COUNTER_VISIBLE_AT_REMAINING ? counterId : null].filter(Boolean).join(" ") || undefined}
      />
      {remaining <= COUNTER_VISIBLE_AT_REMAINING && (
        <p id={counterId} role="status" className="text-micro tabular-nums text-text-muted">
          {remaining} {remaining === 1 ? "character" : "characters"} left
        </p>
      )}
    </Field>
  );
}
