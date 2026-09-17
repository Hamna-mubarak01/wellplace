"use client";

import { useId, useState } from "react";
import { RefreshCwIcon } from "lucide-react";

import {
  COUPON_GENERATION,
  COUPON_PATTERN_MESSAGE,
} from "@/lib/config/coupons";
import {
  fixedCodeSegments,
  joinCodeParts,
  patternCodeLength,
  randomSegment,
} from "@/lib/domain/vouchers/coupon-codes";
import {
  codePattern,
  patternProblem,
  type CouponCreateDraft,
} from "@/components/console/manage/coupons/coupon-create-model";
import { Input } from "@/components/console/reception/reception-input";
import { Button } from "@/components/shared/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import { Field, FieldLabel } from "@/components/ui/field";

export interface CouponRandomCodeFieldsProps {
  draft: CouponCreateDraft;
  onChange: (patch: Partial<CouponCreateDraft>) => void;
  disabled: boolean;
}

const SEGMENTS = [
  ["prefix", "Prefix"],
  ["brandName", "Brand name"],
  ["brandNumber", "Brand number"],
] as const;

const RANDOM_LENGTHS = Array.from(
  { length: COUPON_GENERATION.randomLengthMax - COUPON_GENERATION.randomLengthMin + 1 },
  (_, index) => COUPON_GENERATION.randomLengthMin + index,
);

function exampleCharacters(): string {
  return randomSegment(COUPON_GENERATION.randomLengthMax, COUPON_GENERATION.alphabet, (maxExclusive) =>
    Math.floor(Math.random() * maxExclusive),
  );
}

export function CouponRandomCodeFields({ draft, onChange, disabled }: CouponRandomCodeFieldsProps) {
  const id = useId();
  const [characters, setCharacters] = useState(exampleCharacters);
  const pattern = codePattern(draft);
  const problem = patternProblem(draft);
  const example = joinCodeParts(fixedCodeSegments(pattern), characters.slice(0, pattern.randomLength));
  const length = patternCodeLength(pattern);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {SEGMENTS.map(([key, title]) => (
          <Field key={key}>
            <FieldLabel htmlFor={`${id}-${key}`}>
              {title} <span className="font-normal text-text-muted">(optional)</span>
            </FieldLabel>
            <Input
              id={`${id}-${key}`}
              value={draft[key]}
              maxLength={COUPON_GENERATION.segmentMaxLength}
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              onChange={(event) => onChange({ [key]: event.target.value.toUpperCase() })}
            />
          </Field>
        ))}
        <Field>
          <FieldLabel htmlFor={`${id}-random`}>Random characters</FieldLabel>
          <Select
            value={String(draft.randomLength)}
            disabled={disabled}
            onValueChange={(value) => {
              const randomLength = RANDOM_LENGTHS.find((option) => String(option) === value);
              if (randomLength !== undefined) onChange({ randomLength });
            }}
          >
            <SelectTrigger id={`${id}-random`} className="h-tap! w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANDOM_LENGTHS.map((option) => (
                <SelectItem key={option} value={String(option)} className="min-h-tap">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex min-w-0 items-center gap-3 rounded-(--radius-control) border border-border bg-surface-sunken py-1 pr-1 pl-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-micro text-text-muted">Example</span>
          <span className="font-data text-console-body font-medium break-all text-text-primary tabular-nums">
            {example}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Show another example"
          disabled={disabled}
          onClick={() => setCharacters(exampleCharacters())}
        >
          <RefreshCwIcon aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <p className="text-micro text-text-secondary">
        Each code is{" "}
        <span className="font-data tabular-nums">{length.toLocaleString("en-AE")}</span>{" "}
        {length === 1 ? "character" : "characters"} long.
      </p>

      {problem !== null && (
        <p role="alert" className="text-console-body text-danger">
          {COUPON_PATTERN_MESSAGE[problem]}
        </p>
      )}
    </div>
  );
}
