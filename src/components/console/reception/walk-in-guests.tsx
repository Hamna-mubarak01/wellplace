"use client";

import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import type {
  GuestRuleFailure,
  GuestRules,
} from "@/lib/validation/reception-booking";
import {
  CONTROL_CLASS,
  HINT_CLASS,
  LABEL_CLASS,
  LEGEND_CLASS,
  fieldId,
} from "@/components/console/reception/walk-in-form";

const STEP_BUTTON_CLASS =
  "size-tap shrink-0 rounded-(--radius-card) border-border bg-surface-raised text-text-primary hover:border-brand hover:bg-surface-hover disabled:opacity-40";

export interface ConsoleCounterProps {
  id: string;
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onValueChange: (next: number) => void;
  decrementLabel: string;
  incrementLabel: string;
}

export function ConsoleCounter({
  id,
  label,
  description,
  value,
  min,
  max,
  disabled,
  onValueChange,
  decrementLabel,
  incrementLabel,
}: ConsoleCounterProps) {
  const labelId = `${id}-label`;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex items-center justify-between gap-4"
    >
      <div className="min-w-0">
        <p id={labelId} className="text-console-body font-medium text-text-primary">
          {label}
        </p>
        <p className={HINT_CLASS}>{description}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={decrementLabel}
          disabled={disabled || value <= min}
          onClick={() => onValueChange(value - 1)}
          className={STEP_BUTTON_CLASS}
        >
          <MinusIcon aria-hidden="true" className="size-4" />
        </Button>
        <span
          id={id}
          tabIndex={-1}
          aria-live="polite"
          className="w-9 text-center font-data text-console-body tabular-nums text-text-primary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={incrementLabel}
          disabled={disabled || value >= max}
          onClick={() => onValueChange(value + 1)}
          className={STEP_BUTTON_CLASS}
        >
          <PlusIcon aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export interface WalkInGuestsProps {
  rules: GuestRules;
  adults: number;
  onAdultsChange: (next: number) => void;
  childAges: readonly (number | null)[];
  onChildAgesChange: (next: (number | null)[]) => void;
  ruleFailure: GuestRuleFailure | null;
  disabled: boolean;
  error?: string;
}

export function WalkInGuests({
  rules,
  adults,
  onAdultsChange,
  childAges,
  onChildAgesChange,
  ruleFailure,
  disabled,
  error,
}: WalkInGuestsProps) {
  const ages = Array.from(
    { length: rules.childMaxAge - rules.childMinAge + 1 },
    (_, index) => rules.childMinAge + index,
  );

  const errorId = error ? fieldId("guests-error") : undefined;

  function setChildCount(next: number) {
    if (next > childAges.length) {
      onChildAgesChange([
        ...childAges,
        ...Array.from({ length: next - childAges.length }, () => null),
      ]);
      return;
    }
    onChildAgesChange(childAges.slice(0, next).map((age) => age));
  }

  return (
    <FieldSet className="gap-3" data-invalid={Boolean(error) || undefined}>
      <FieldLegend className={LEGEND_CLASS}>Guests</FieldLegend>
      {(ruleFailure || error) && <p id={errorId} className="sr-only">{ruleFailure?.message ?? error}</p>}

      <ConsoleCounter
        id={fieldId("adults")}
        label="Adults"
        description={`From ${rules.childMaxAge + 1} a guest counts as an adult.`}
        value={adults}
        min={1}
        max={rules.guestsMax - childAges.length}
        disabled={disabled}
        onValueChange={onAdultsChange}
        decrementLabel="One adult fewer"
        incrementLabel="One adult more"
      />

      <ConsoleCounter
        id={fieldId("children")}
        label="Children"
        description={`Aged ${rules.childMinAge} to ${rules.childMaxAge}. An age is required for each.`}
        value={childAges.length}
        min={0}
        max={Math.max(0, rules.guestsMax - adults)}
        disabled={disabled}
        onValueChange={setChildCount}
        decrementLabel="One child fewer"
        incrementLabel="One child more"
      />

      {childAges.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {childAges.map((age, index) => {
            const id = fieldId(`child-age-${index}`);
            const labelId = `${id}-label`;
            return (
              <Field key={id} className="min-w-0 gap-1.5">
                <FieldLabel htmlFor={id} id={labelId} className={LABEL_CLASS}>
                  {`Child ${index + 1} age`}
                  <span aria-hidden="true" className="ml-1 text-brand">
                    *
                  </span>
                  <span className="sr-only"> (required)</span>
                </FieldLabel>
                <Select
                  value={age === null ? undefined : String(age)}
                  disabled={disabled}
                  onValueChange={(next) => {
                    const updated = [...childAges];
                    updated[index] = Number(next);
                    onChildAgesChange(updated);
                  }}
                >
                  <SelectTrigger
                    id={id}
                    aria-labelledby={`${labelId} ${id}`}
                    aria-invalid={age === null && Boolean(error) ? true : undefined}
                    className={CONTROL_CLASS}
                  >
                    <SelectValue placeholder="Age" />
                  </SelectTrigger>
                  <SelectContent>
                    {ages.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            );
          })}
        </div>
      ) : null}

    </FieldSet>
  );
}
