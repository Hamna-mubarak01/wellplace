"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/console/reception/reception-input";
import { REASON_MAX_LENGTH } from "@/lib/config/console-limits";
import type { ReasonFieldProps } from "@/components/shared/reason-field";

export function ReasonField({ id, value, onChange, error, disabled, label = "Reason", maxLength = REASON_MAX_LENGTH, required = true }: ReasonFieldProps & { required?: boolean }) {
  return <Field data-invalid={Boolean(error) || undefined}>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required} rows={2} maxLength={maxLength} aria-invalid={Boolean(error) || undefined} />
  </Field>;
}
