"use client";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLineIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";

import {
  setManualPrice,
  type BookingActionResult,
} from "@/app/(console)/reception/actions";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { CONSOLE_MONEY_AED } from "@/lib/config/console-limits";
import { aedToFils, formatAed, parseAed, toAedInput } from "@/components/shared/money";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/console/reception/reception-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/console/reception/reception-input";
import { ReasonField } from "@/components/console/reception/reception-reason-field";
import {
  HINT_CLASS,
  NOTE_CLASS,
} from "@/components/console/reception/walk-in-form";

export interface ManualPriceDialogProps {
  bookingId: string;
  currentTotalFils: number | null;
}

export function ManualPriceDialog({
  bookingId,
  currentTotalFils,
}: ManualPriceDialogProps) {
  const router = useRouter();
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => toAedInput(currentTotalFils ?? 0));
  const [reason, setReason] = useState("");

  const totalFils = parseAed(amount);
  const lowestFils = aedToFils(CONSOLE_MONEY_AED.min);
  const highestFils = aedToFils(CONSOLE_MONEY_AED.max);

  const difference =
    totalFils === null || currentTotalFils === null
      ? null
      : totalFils - currentTotalFils;

  const close = () => {
    setOpen(false);
    setAmount(toAedInput(currentTotalFils ?? 0));
    setReason("");

  };

  const submit = () => {
    if (pending) return;
    if (totalFils === null) {
      reject("manual-price-amount", "Enter the new total in AED, for example 450.00.");
      return;
    }

    if (totalFils < lowestFils || totalFils > highestFils) {
      reject("manual-price-amount",
        `Enter between ${formatAed(lowestFils)} and ${formatAed(highestFils)}.`,
      );
      return;
    }

    if (reason.trim().length === 0) {
      reject("manual-price-reason", "Enter a reason for changing the price.");
      return;
    }

    start(async () => {
      let result: BookingActionResult;

      try {
        result = await setManualPrice({ bookingId, totalFils, reason });
      } catch (cause) {
        console.error("[console] setManualPrice threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success("Price changed");
        close();
        router.refresh();
        return;
      }

      toast.error("Nothing was changed", { description: result.message });

    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        if (next) {
          setAmount(toAedInput(currentTotalFils ?? 0));
          setOpen(true);
        } else close();
      }}
    >
      <DialogTrigger asChild>
        <Button hoverEffect="sweep" type="button" variant="outline" size="sm" className="min-h-tap">
          <PencilLineIcon aria-hidden="true" />
          Change price
        </Button>
      </DialogTrigger>

      <DialogContent pending={pending} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change this booking&rsquo;s price</DialogTitle>
          <DialogDescription>New total payable by the guest.</DialogDescription>
        </DialogHeader>



        <div className="flex flex-col gap-1">
          <p className="text-console-body text-text-secondary">Total now</p>
          <p className="font-data text-console-body tabular-nums text-text-primary">
            {currentTotalFils === null
              ? "No price stored yet"
              : formatAed(currentTotalFils)}
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="manual-price-amount">New total</FieldLabel>
          <Input
            id="manual-price-amount"
            type="number"
            required
            inputMode="decimal"
            min={CONSOLE_MONEY_AED.min}
            max={CONSOLE_MONEY_AED.max}
            step={CONSOLE_MONEY_AED.step}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);

            }}
            disabled={pending}
            aria-describedby="manual-price-amount-hint"
            className="h-tap font-data tabular-nums text-console-body"
          />
          <p id="manual-price-amount-hint" className={HINT_CLASS}>
            Between {formatAed(lowestFils)} and {formatAed(highestFils)},
            including VAT and any service fee.
          </p>

        </Field>

        {difference !== null && difference !== 0 && (
          <p className={NOTE_CLASS}>
            <span className="min-w-0 text-pretty">
              The guest pays{" "}
              <span className="font-data font-medium tabular-nums">
                {formatAed(Math.abs(difference))}
              </span>{" "}
              {difference > 0 ? "more" : "less"} than the calculated price.
            </span>
          </p>
        )}

        <ReasonField
          id="manual-price-reason"
          value={reason}
          onChange={(next) => {
            setReason(next);

          }}

          disabled={pending}
        />

        <DialogFooter>
          <Button hoverEffect="sweep" type="button" variant="ghost" onClick={close} disabled={pending}>
            Keep the current price
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save price"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
