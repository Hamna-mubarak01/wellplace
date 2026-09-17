"use client";
import { useId, useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { messageButtonColorSchema } from "@/lib/validation/message-button";

export function AppearanceNumber({
  label,
  value,
  bounds,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  bounds: { min: number; max: number };
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState({ raw: String(value), committed: value });
  if (draft.committed !== value)
    setDraft({ raw: String(value), committed: value });
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label} (px)</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={bounds.min}
        max={bounds.max}
        disabled={disabled}
        value={draft.raw}
        onChange={(event) => {
          const raw = event.target.value;
          const next = Number(raw);
          const valid =
            raw.trim() !== "" &&
            Number.isInteger(next) &&
            next >= bounds.min &&
            next <= bounds.max;
          setDraft({ raw, committed: valid ? next : value });
          if (valid) onChange(next);
        }}
        onBlur={() => setDraft({ raw: String(value), committed: value })}
      />
    </Field>
  );
}

export function AppearanceColor({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState({ raw: value, committed: value });
  if (draft.committed !== value) setDraft({ raw: value, committed: value });
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex min-w-0 gap-2">
        <Input
          type="color"
          aria-label={`Choose ${label.toLowerCase()}`}
          value={value}
          disabled={disabled}
          className="h-tap w-tap shrink-0 cursor-pointer p-1"
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          id={id}
          value={draft.raw}
          disabled={disabled}
          className="min-w-0 flex-1"
          spellCheck={false}
          onChange={(event) => {
            const raw = event.target.value;
            const parsed = messageButtonColorSchema.safeParse(raw);
            setDraft({ raw, committed: parsed.success ? raw : value });
            if (parsed.success) onChange(raw);
          }}
          onBlur={() => setDraft({ raw: value, committed: value })}
        />
      </div>
    </Field>
  );
}
