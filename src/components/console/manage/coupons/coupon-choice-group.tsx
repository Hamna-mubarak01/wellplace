"use client";

import { useId } from "react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface CouponChoiceOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

export interface CouponChoiceGroupProps<Value extends string> {
  legend: string;
  value: Value;
  options: readonly CouponChoiceOption<Value>[];
  onValueChange: (value: Value) => void;
  disabled?: boolean;
}

const OPTION_CLASS =
  "flex min-h-tap min-w-0 cursor-pointer items-center gap-3 rounded-(--radius-control) border border-border bg-surface-raised px-3 py-2 text-console-body font-normal text-text-primary motion-safe:transition-colors hover:bg-surface-hover has-data-checked:border-brand has-data-checked:bg-surface-active has-disabled:cursor-not-allowed";

export function CouponChoiceGroup<Value extends string>({
  legend,
  value,
  options,
  onValueChange,
  disabled = false,
}: CouponChoiceGroupProps<Value>) {
  const id = useId();

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-field-label font-medium text-text-secondary">{legend}</legend>
      <RadioGroup
        value={value}
        disabled={disabled}
        aria-label={legend}
        onValueChange={(next) => {
          const match = options.find((option) => option.value === next);
          if (match) onValueChange(match.value);
        }}
        className="grid grid-cols-2 gap-2"
      >
        {options.map((option) => (
          <Label key={option.value} htmlFor={`${id}-${option.value}`} className={OPTION_CLASS}>
            <RadioGroupItem value={option.value} id={`${id}-${option.value}`} />
            <span className="min-w-0 text-pretty">{option.label}</span>
          </Label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
