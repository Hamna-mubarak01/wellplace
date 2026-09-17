"use client";

import { useEffect, useId, type ComponentProps } from "react";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import { receptionControlError } from "@/lib/validation/reception-control";
import { useReceptionValidation } from "@/components/console/reception/reception-validation";
import { cn } from "@/lib/utils";

function useControl(id: string) {
  const { errors, clear, reject } = useReceptionValidation();
  useEffect(() => () => clear(id), [clear, id]);
  return { error: errors[id], clear: () => clear(id), reject: (message: string) => reject(id, message) };
}

export function Input({ id: suppliedId, type, min, max, step, maxLength, required, onChange, onBlur, className, ...props }: ComponentProps<typeof ShadcnInput>) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const { error, clear, reject } = useControl(id);
  const numeric = type === "number";
  const rules = { numeric, min: min === undefined ? undefined : Number(min), max: max === undefined ? undefined : Number(max), step: step === undefined || step === "any" ? undefined : Number(step), maxLength, required };
  return <ShadcnInput
    {...props}
    id={id}
    type={numeric ? "text" : type}
    inputMode={numeric ? rules.step !== undefined && !Number.isInteger(rules.step) ? "decimal" : "numeric" : props.inputMode}
    min={min}
    max={max}
    step={step}
    required={required}
    data-max-length={maxLength}
    aria-invalid={Boolean(error) || props["aria-invalid"] || undefined}
    className={cn("reception-input h-tap", className)}
    onChange={(event) => {
      const message = receptionControlError(event.target.value, rules);
      if (message) { reject(message); return; }
      clear();
      onChange?.(event);
    }}
    onBlur={(event) => {
      const message = receptionControlError(event.target.value, { ...rules, required: false }, true);
      if (message) reject(message);
      else clear();
      onBlur?.(event);
    }}
  />;
}

export function Textarea({ id: suppliedId, maxLength, required, onChange, onBlur, className, ...props }: ComponentProps<typeof ShadcnTextarea>) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const { error, clear, reject } = useControl(id);
  return <ShadcnTextarea
    {...props}
    id={id}
    required={required}
    data-max-length={maxLength}
    aria-invalid={Boolean(error) || props["aria-invalid"] || undefined}
    className={cn("reception-input resize-none overflow-hidden text-console-body", className)}
    onChange={(event) => {
      const message = receptionControlError(event.target.value, { maxLength, required });
      if (message) { reject(message); return; }
      clear();
      onChange?.(event);
    }}
    onBlur={(event) => {
      const message = receptionControlError(event.target.value, { maxLength }, true);
      if (message) reject(message);
      else clear();
      onBlur?.(event);
    }}
  />;
}
