"use client";

import { InfoIcon } from "lucide-react";

import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/console/reception/reception-input";
import { formatAed } from "@/components/shared/money";
import {
  BOOKING_NOTE_MAX_LENGTH,
  SPECIAL_REQUEST_MAX_LENGTH,
} from "@/lib/config/console-limits";
import {
  CharacterCounter,
  showsCharacterCounter,
} from "@/components/shared/character-counter";
import type { CartLine } from "@/lib/domain/vouchers";
import { AddonRow } from "@/components/console/reception/addon-row";
import {
  AREA_CLASS,
  HINT_CLASS,
  LABEL_CLASS,
  LEGEND_CLASS,
  NOTE_CLASS,
  fieldId,
  type ReceptionAddonOption,
} from "@/components/console/reception/walk-in-form";

export type { ReceptionAddonOption };

export interface WalkInExtrasProps {
  addons: readonly ReceptionAddonOption[];
  cart: readonly CartLine[];
  onQuantityChange: (id: string, quantity: number) => void;
  personalRequest: string;
  onPersonalRequestChange: (next: string) => void;
  internalNote: string;
  onInternalNoteChange: (next: string) => void;
  disabled: boolean;
}

export function WalkInExtras({
  addons,
  cart,
  onQuantityChange,
  personalRequest,
  onPersonalRequestChange,
  internalNote,
  onInternalNoteChange,
  disabled,
}: WalkInExtrasProps) {
  const chargedFils = cart.reduce(
    (total, line) => total + line.unitPriceFils * line.quantity,
    0,
  );
  const includedCount = cart.filter((line) => line.isIncluded).length;

  return (
    <FieldSet className="gap-3">
      <FieldLegend className={LEGEND_CLASS}>Extras</FieldLegend>

      {addons.length === 0 ? (
        <p className={NOTE_CLASS}>
          <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 text-pretty">
            No add-ons have been set up yet. Add them in Management, or note
            what the guest asked for below.
          </span>
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {addons.map((addon) => (
              <AddonRow
                key={addon.id}
                addon={addon}
                line={cart.find((line) => line.id === addon.id) ?? null}
                onQuantityChange={onQuantityChange}
                disabled={disabled}
              />
            ))}
          </ul>

          {cart.length === 0 ? (
            <p className={HINT_CLASS}>
              Nothing added. The guest can take any of these at the desk.
            </p>
          ) : (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-3">
              <span className="text-console-body text-text-secondary">
                Extras
                {includedCount > 0 ? (
                  <span className="ml-1 text-micro text-text-muted">
                    {includedCount === 1
                      ? "including 1 free item"
                      : `including ${includedCount} free items`}
                  </span>
                ) : null}
              </span>
              <span className="font-data text-console-body tabular-nums text-text-primary">
                {formatAed(chargedFils)}
              </span>
            </div>
          )}
        </>
      )}

      <Field className="gap-2">
        <FieldLabel htmlFor={fieldId("personal-request")} className={LABEL_CLASS}>
          Personal request
        </FieldLabel>
        <Textarea
          id={fieldId("personal-request")}
          name="personalRequest"
          rows={2}
          maxLength={SPECIAL_REQUEST_MAX_LENGTH}
          disabled={disabled}
          value={personalRequest}
          placeholder="Anything the guest asked for."
          onChange={(event) =>
            onPersonalRequestChange(
              event.target.value.slice(0, SPECIAL_REQUEST_MAX_LENGTH),
            )
          }
          aria-describedby={
            showsCharacterCounter(personalRequest, SPECIAL_REQUEST_MAX_LENGTH)
              ? fieldId("personal-request-remaining")
              : fieldId("personal-request-hint")
          }
          className={AREA_CLASS}
        />
        <p id={fieldId("personal-request-hint")} className={HINT_CLASS}>
          Up to {SPECIAL_REQUEST_MAX_LENGTH} characters.
        </p>
        <CharacterCounter
          id={fieldId("personal-request-remaining")}
          value={personalRequest}
          maxLength={SPECIAL_REQUEST_MAX_LENGTH}
        />
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor={fieldId("internal-note")} className={LABEL_CLASS}>
          Internal note
        </FieldLabel>
        <Textarea
          id={fieldId("internal-note")}
          name="internalNote"
          rows={2}
          maxLength={BOOKING_NOTE_MAX_LENGTH}
          disabled={disabled}
          value={internalNote}
          placeholder="For staff only. The guest never sees this."
          onChange={(event) =>
            onInternalNoteChange(
              event.target.value.slice(0, BOOKING_NOTE_MAX_LENGTH),
            )
          }
          aria-describedby={
            showsCharacterCounter(internalNote, BOOKING_NOTE_MAX_LENGTH)
              ? fieldId("internal-note-remaining")
              : fieldId("internal-note-hint")
          }
          className={AREA_CLASS}
        />
        <p id={fieldId("internal-note-hint")} className={HINT_CLASS}>
          Kept on the booking for Reception and Management, up to{" "}
          {BOOKING_NOTE_MAX_LENGTH} characters.
        </p>
        <CharacterCounter
          id={fieldId("internal-note-remaining")}
          value={internalNote}
          maxLength={BOOKING_NOTE_MAX_LENGTH}
        />
      </Field>
    </FieldSet>
  );
}
