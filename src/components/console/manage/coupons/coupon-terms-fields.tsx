"use client";

import Link from "next/link";
import { useId } from "react";

import { COUPON_KINDS, COUPON_KIND_LABEL } from "@/app/(console)/manage/coupons/coupons-view";
import { CONSOLE_MONEY_AED } from "@/lib/config/console-limits";
import { COUPON_LIMITS } from "@/lib/config/coupons";
import { HoursDateField } from "@/components/console/manage/hours-date-field";
import type {
  CouponAddonChoices,
  CouponKind,
  CouponTermsDraft,
  CouponTermsField,
} from "@/components/console/manage/coupons/coupon-terms-model";
import { Input } from "@/components/console/reception/reception-input";
import { Button } from "@/components/shared/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";

export interface CouponTermsFieldsProps {
  terms: CouponTermsDraft;
  onChange: (patch: Partial<CouponTermsDraft>) => void;
  addons: CouponAddonChoices;
  disabled: boolean;
  invalid?: CouponTermsField | null;
}

const CHECK_ROW_CLASS = "flex min-h-tap cursor-pointer items-center gap-3 text-console-body text-text-primary";

const DATE_FIELDS = [
  ["validFrom", "Starts on"],
  ["validTo", "Expires on"],
] as const;

const USE_FIELDS = [
  ["maxUses", "Total uses"],
  ["perCustomerLimit", "Uses per customer"],
] as const;

function isCouponKind(value: string): value is CouponKind {
  return COUPON_KINDS.some((kind) => kind === value);
}

function AddonPicker({
  id,
  terms,
  addons,
  disabled,
  invalid,
  onChange,
}: {
  id: string;
  terms: CouponTermsDraft;
  addons: CouponAddonChoices;
  disabled: boolean;
  invalid: boolean;
  onChange: (patch: Partial<CouponTermsDraft>) => void;
}) {
  if (addons === null) {
    return (
      <p className="text-console-body text-danger">
        Add-ons could not be loaded. Reload the page to choose free add-ons.
      </p>
    );
  }

  if (addons.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-console-body text-text-secondary">There are no add-ons to offer for free yet.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/manage/pricing">Open prices and add-ons</Link>
        </Button>
      </div>
    );
  }

  return (
    <fieldset aria-invalid={invalid || undefined} className="flex min-w-0 flex-col gap-1">
      <legend className={invalid ? "mb-1 text-sm font-medium text-danger" : "mb-1 text-sm font-medium"}>
        Included add-ons
      </legend>
      {addons.map((addon) => (
        <label key={addon.id} htmlFor={`${id}-addon-${addon.id}`} className={CHECK_ROW_CLASS}>
          <Checkbox
            id={`${id}-addon-${addon.id}`}
            checked={terms.addonIds.includes(addon.id)}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange({
                addonIds: checked
                  ? [...terms.addonIds, addon.id]
                  : terms.addonIds.filter((addonId) => addonId !== addon.id),
              })
            }
          />
          <span className="min-w-0 text-pretty">{addon.name}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function CouponTermsFields({ terms, onChange, addons, disabled, invalid = null }: CouponTermsFieldsProps) {
  const id = useId();
  const fixed = terms.kind === "fixed";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-kind`}>Discount type</FieldLabel>
          <Select
            value={terms.kind}
            disabled={disabled}
            onValueChange={(kind) => {
              if (isCouponKind(kind)) onChange({ kind, value: "" });
            }}
          >
            <SelectTrigger id={`${id}-kind`} className="h-tap! w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUPON_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind} className="min-h-tap">
                  {COUPON_KIND_LABEL[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {terms.kind !== "addon_free" && (
          <Field data-invalid={invalid === "value" || undefined}>
            <FieldLabel htmlFor={`${id}-value`}>{fixed ? "Discount (AED)" : "Discount (%)"}</FieldLabel>
            <Input
              id={`${id}-value`}
              type="number"
              min={CONSOLE_MONEY_AED.step}
              max={fixed ? CONSOLE_MONEY_AED.max : COUPON_LIMITS.percentMax}
              step={CONSOLE_MONEY_AED.step}
              value={terms.value}
              disabled={disabled}
              aria-invalid={invalid === "value" || undefined}
              onChange={(event) => onChange({ value: event.target.value })}
            />
          </Field>
        )}
      </div>

      {terms.kind === "addon_free" && (
        <AddonPicker
          id={id}
          terms={terms}
          addons={addons}
          disabled={disabled}
          invalid={invalid === "addonIds"}
          onChange={onChange}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {DATE_FIELDS.map(([key, title]) => (
          <div className="flex min-w-0 flex-col gap-1" key={key}>
            <HoursDateField
              label={title}
              value={terms[key] ?? ""}
              disabled={disabled}
              invalid={invalid === key}
              onChange={(value) => onChange({ [key]: value || null })}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="self-start"
              disabled={disabled || !terms[key]}
              onClick={() => onChange({ [key]: null })}
            >
              Clear date
            </Button>
          </div>
        ))}
      </div>
      <p className="text-micro text-text-secondary">
        Expiry is inclusive, at the end of the day in Dubai. Leave dates empty for no date limit.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {USE_FIELDS.map(([key, title]) => (
          <Field key={key} data-invalid={invalid === key || undefined}>
            <FieldLabel htmlFor={`${id}-${key}`}>{title}</FieldLabel>
            <Input
              id={`${id}-${key}`}
              type="number"
              min={1}
              max={COUPON_LIMITS.maxUses}
              step={1}
              placeholder="Unlimited"
              value={terms[key] ?? ""}
              disabled={disabled}
              aria-invalid={invalid === key || undefined}
              onChange={(event) =>
                onChange({ [key]: event.target.value === "" ? null : Number(event.target.value) })
              }
            />
          </Field>
        ))}
      </div>

      <div className="flex min-w-0 flex-col">
        <label htmlFor={`${id}-combinable`} className={CHECK_ROW_CLASS}>
          <Checkbox
            id={`${id}-combinable`}
            checked={terms.isCombinable}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ isCombinable: checked === true })}
          />
          Can be combined with other offers
        </label>
        <label htmlFor={`${id}-active`} className={CHECK_ROW_CLASS}>
          <Checkbox
            id={`${id}-active`}
            checked={terms.isActive}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ isActive: checked === true })}
          />
          Active
        </label>
      </div>
    </div>
  );
}
