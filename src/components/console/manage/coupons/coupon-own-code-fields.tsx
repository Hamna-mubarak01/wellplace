"use client";

import { useId } from "react";

import { COUPON_GENERATION, COUPON_LIMITS } from "@/lib/config/coupons";
import {
  codesInUse,
  listFormat,
  parsedCodeList,
  singleCodeMessage,
  type CouponCreateDraft,
} from "@/components/console/manage/coupons/coupon-create-model";
import { Input } from "@/components/console/reception/reception-input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export interface CouponOwnCodeFieldsProps {
  draft: CouponCreateDraft;
  onChange: (patch: Partial<CouponCreateDraft>) => void;
  conflicts: readonly string[];
  disabled: boolean;
}

function CodeNames({ codes }: { codes: readonly string[] }) {
  return <span className="font-data break-all tabular-nums">{listFormat(codes)}</span>;
}

function InUse({ codes }: { codes: readonly string[] }) {
  if (codes.length === 0) return null;
  return (
    <p role="alert" className="text-console-body text-danger">
      Already in use: <CodeNames codes={codes} />
    </p>
  );
}

function SingleCodeField({ draft, onChange, conflicts, disabled }: CouponOwnCodeFieldsProps) {
  const id = useId();
  const message = singleCodeMessage(draft.singleCode);
  const inUse = codesInUse(draft, conflicts);

  return (
    <Field data-invalid={message !== null || inUse.length > 0 || undefined}>
      <FieldLabel htmlFor={`${id}-code`}>Coupon code</FieldLabel>
      <Input
        id={`${id}-code`}
        value={draft.singleCode}
        maxLength={COUPON_LIMITS.codeMax}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={message !== null || inUse.length > 0 || undefined}
        aria-describedby={`${id}-code-hint`}
        className="font-data"
        onChange={(event) => onChange({ singleCode: event.target.value.toUpperCase() })}
      />
      <p id={`${id}-code-hint`} className="text-micro text-text-secondary">
        {COUPON_LIMITS.codeMin} to {COUPON_LIMITS.codeMax} characters: letters, numbers and single hyphens.
      </p>
      {message !== null && <p className="text-console-body text-danger">{message}</p>}
      <InUse codes={inUse} />
    </Field>
  );
}

function CodeListField({ draft, onChange, conflicts, disabled }: CouponOwnCodeFieldsProps) {
  const id = useId();
  const list = parsedCodeList(draft);
  const inUse = codesInUse(draft, conflicts);
  const tooMany = list.codes.length > COUPON_GENERATION.batchMax;
  const invalid = list.invalid.length > 0 || inUse.length > 0 || tooMany;

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={`${id}-codes`}>Coupon codes</FieldLabel>
      <Textarea
        id={`${id}-codes`}
        value={draft.codeList}
        rows={5}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-codes-hint ${id}-codes-status`}
        className="max-h-console-panel min-h-console-tile resize-none overflow-y-auto font-data text-console-body"
        onChange={(event) => onChange({ codeList: event.target.value })}
      />
      <p id={`${id}-codes-hint`} className="text-micro text-text-secondary">
        One per line, or separated by commas or spaces. Up to {COUPON_GENERATION.batchMax.toLocaleString("en-AE")}{" "}
        codes of {COUPON_LIMITS.codeMin} to {COUPON_LIMITS.codeMax} characters each.
      </p>
      <div id={`${id}-codes-status`} aria-live="polite" className="flex min-w-0 flex-col gap-1">
        {list.codes.length > 0 && (
          <p className="text-console-body text-text-primary">
            <span className="font-data tabular-nums">{list.codes.length.toLocaleString("en-AE")}</span>{" "}
            {list.codes.length === 1 ? "code" : "codes"} ready
          </p>
        )}
        {tooMany && (
          <p className="text-console-body text-danger">
            Enter no more than {COUPON_GENERATION.batchMax.toLocaleString("en-AE")} codes at a time.
          </p>
        )}
        {list.invalid.length > 0 && (
          <p className="text-console-body text-danger">
            Not valid: <CodeNames codes={list.invalid} />
          </p>
        )}
        {list.duplicates.length > 0 && (
          <p className="text-console-body text-text-secondary">
            Listed more than once, created once: <CodeNames codes={list.duplicates} />
          </p>
        )}
        <InUse codes={inUse} />
      </div>
    </Field>
  );
}

export function CouponOwnCodeFields(props: CouponOwnCodeFieldsProps) {
  return props.draft.quantity === "single" ? <SingleCodeField {...props} /> : <CodeListField {...props} />;
}
