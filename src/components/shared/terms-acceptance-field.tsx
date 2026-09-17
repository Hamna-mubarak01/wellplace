"use client";

import Link from "next/link";
import {
  Fragment,
  type ComponentProps,
  type MouseEvent,
} from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { TERMS_ACCEPTANCE } from "@/lib/config/consent";

type CheckboxProps = ComponentProps<typeof Checkbox>;

interface TermsAcceptanceFieldProps {
  id: string;
  checked: boolean;
  onCheckedChange: NonNullable<CheckboxProps["onCheckedChange"]>;
  disabled?: boolean;
  error?: string;
  checkboxRef?: CheckboxProps["ref"];
}

function stopLabelActivation(event: MouseEvent<HTMLAnchorElement>) {
  event.stopPropagation();
}

export function TermsAcceptanceField({
  id,
  checked,
  onCheckedChange,
  disabled,
  error,
  checkboxRef,
}: TermsAcceptanceFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-(--space-consent-gap)">
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          ref={checkboxRef}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-px size-4 rounded-xs bg-surface-raised"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <Label
            htmlFor={id}
            className="block text-micro leading-normal font-normal text-text-secondary text-pretty"
          >
            {TERMS_ACCEPTANCE.segments.map((segment, index) =>
              segment.href ? (
                <Link
                  key={index}
                  href={segment.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={stopLabelActivation}
                  className="underline underline-offset-2 hover:text-text-primary"
                >
                  {segment.text}
                </Link>
              ) : (
                <Fragment key={index}>{segment.text}</Fragment>
              ),
            )}
          </Label>
          {error && (
            <FieldError id={errorId} className="text-micro font-medium">
              {error}
            </FieldError>
          )}
        </div>
      </div>
    </div>
  );
}
