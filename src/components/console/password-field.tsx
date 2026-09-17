"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

const MASK_PLACEHOLDER = "••••••••••";

export interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  description?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
}

export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  autoFocus,
  required,
  minLength,
  disabled,
  description,
  error,
  className,
}: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionId = useId();

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;

    const remask = () => setRevealed(false);
    form.addEventListener("submit", remask);
    return () => form.removeEventListener("submit", remask);
  }, []);

  return (
    <Field className={cn("gap-2", className)} data-invalid={error ? true : undefined}>
      <FieldLabel
        htmlFor={id}
        className="gap-1 text-field-label font-medium text-text-secondary"
      >
        {label}
      </FieldLabel>

      <InputGroup className="h-control rounded-(--radius-control) bg-surface-raised">
        <InputGroupInput
          ref={inputRef}
          id={id}
          name={name}
          type={revealed ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required={required}
          minLength={minLength}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={description ? descriptionId : undefined}
          placeholder={MASK_PLACEHOLDER}
          className="h-full ps-4 text-console-body"
        />

        <InputGroupAddon
          align="inline-end"
          className="h-full py-0 pe-1"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setRevealed((shown) => !shown)}
            disabled={disabled}
            aria-pressed={revealed}
            aria-controls={id}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="size-tap rounded-full"
          >
            {revealed ? (
              <EyeOffIcon aria-hidden="true" className="size-4.5" />
            ) : (
              <EyeIcon aria-hidden="true" className="size-4.5" />
            )}
          </Button>
        </InputGroupAddon>
      </InputGroup>

      {description && (
        <FieldDescription id={descriptionId} className="text-micro">
          {description}
        </FieldDescription>
      )}
      {error && <FieldError className="text-micro font-medium">{error}</FieldError>}
    </Field>
  );
}
