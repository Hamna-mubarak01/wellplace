"use client";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanknoteArrowDownIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";

import { recordRefund, type RefundActionResult } from "@/app/(console)/refund-actions";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/console/reception/reception-input";
import { ReasonField } from "@/components/console/reception/reception-reason-field";
import { HINT_CLASS } from "@/components/console/reception/walk-in-form";

export interface RefundDialogProps {
  bookingId: string;
  paymentId: string;
  paymentAmountFils: number;
  paymentLabel: string;
}

export function RefundDialog({
  bookingId,
  paymentId,
  paymentAmountFils,
  paymentLabel,
}: RefundDialogProps) {
  const router = useRouter();
  const requestKey = useRef<string | null>(null);
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => toAedInput(paymentAmountFils));
  const [reason, setReason] = useState("");
  const [cancelBooking, setCancelBooking] = useState(true);

  const amountFils = parseAed(amount);
  const maximumFils = Math.min(paymentAmountFils, aedToFils(CONSOLE_MONEY_AED.max));
  const smallestFils = aedToFils(CONSOLE_MONEY_AED.step);

  const close = () => {
    setOpen(false);
    setAmount(toAedInput(paymentAmountFils));
    setReason("");
    setCancelBooking(true);
    requestKey.current = null;

  };

  const submit = () => {
    if (pending) return;
    if (amountFils === null) {
      reject(`refund-amount-${paymentId}`, "Enter the refund in AED, for example 120.00.");
      return;
    }

    if (amountFils < smallestFils) {
      reject(`refund-amount-${paymentId}`,
        `Enter at least ${formatAed(smallestFils)}. A refund must be more than zero.`,
      );
      return;
    }

    if (amountFils > maximumFils) {
      reject(`refund-amount-${paymentId}`,
        `Enter no more than ${formatAed(maximumFils)}. The refund must fit within the remaining payment and the amount limit.`,
      );
      return;
    }

    if (reason.trim().length === 0) {
      reject(`refund-reason-${paymentId}`, "Enter a reason for the refund.");
      return;
    }

    start(async () => {
      let result: RefundActionResult;

      try {
        result = await recordRefund({ bookingId, paymentId, amountFils, reason, cancelBooking, requestKey: requestKey.current ??= crypto.randomUUID() });
      } catch (cause) {
        console.error("[console] recordRefund threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success(
          result.bookingCancelled ? "Refund recorded and booking cancelled" : "Refund request recorded",
          result.bookingCancelled
            ? { description: "The suite and time slot are free for other guests again." }
            : cancelBooking
              ? { description: "The booking has already started or ended, so it was kept." }
              : undefined,
        );
        close();
        router.refresh();
        return;
      }

      toast.error("Nothing was refunded", { description: result.message });

    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        if (next) {
          setAmount(toAedInput(maximumFils));
          setOpen(true);
        } else close();
      }}
    >
      <DialogTrigger asChild>
        <Button hoverEffect="sweep" type="button" variant="outline" size="sm" className="min-h-tap">
          <BanknoteArrowDownIcon aria-hidden="true" />
          Refund
        </Button>
      </DialogTrigger>

      <DialogContent pending={pending} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a refund request</DialogTitle>
          <DialogDescription>Simulated payments are refunded immediately. Live refunds remain pending until the funds are returned.</DialogDescription>
        </DialogHeader>



        <div className="flex flex-col gap-1">
          <p className="text-console-body text-text-secondary">{paymentLabel}</p>
          <p className="font-data text-console-body tabular-nums text-text-primary">
            {formatAed(paymentAmountFils)} available to refund
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor={`refund-amount-${paymentId}`}>
            Refund amount
          </FieldLabel>
          <Input
            id={`refund-amount-${paymentId}`}
            type="number"
            required
            inputMode="decimal"
            min={CONSOLE_MONEY_AED.step}
            max={toAedInput(maximumFils)}
            step={CONSOLE_MONEY_AED.step}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);

            }}
            disabled={pending}
            aria-describedby={`refund-amount-hint-${paymentId}`}
            className="h-tap font-data tabular-nums text-console-body"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              hoverEffect="sweep"
              type="button"
              variant="outline"
              size="sm"
              className="min-h-tap"
              disabled={pending}
              onClick={() => {
                setAmount(toAedInput(paymentAmountFils));

              }}
            >
              Refund remaining amount
            </Button>
          </div>
          <p id={`refund-amount-hint-${paymentId}`} className={HINT_CLASS}>
            Between {formatAed(smallestFils)} and {formatAed(paymentAmountFils)}.
            Earlier refunds against this payment count towards the total.
          </p>

        </Field>

        <label
          htmlFor={`refund-cancel-${paymentId}`}
          className="flex cursor-pointer items-start gap-3 rounded-(--radius-card) border border-border bg-surface-sunken p-3"
        >
          <Checkbox
            id={`refund-cancel-${paymentId}`}
            checked={cancelBooking}
            onCheckedChange={(next) => setCancelBooking(next === true)}
            disabled={pending}
            className="mt-0.5"
          />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-console-body font-medium text-text-primary">Cancel the booking and free the suite</span>
            <span className={HINT_CLASS}>
              The time slot becomes bookable again at once. Untick this only when the guest keeps the booking, for example after being charged on the wrong card.
            </span>
          </span>
        </label>

        <ReasonField
          id={`refund-reason-${paymentId}`}
          value={reason}
          onChange={(next) => {
            setReason(next);

          }}

          disabled={pending}
        />

        <DialogFooter>
          <Button hoverEffect="sweep" type="button" variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button
            hoverEffect="sweep"
            type="button"
            variant="destructive"
            onClick={submit}
            disabled={pending}
          >
            {pending ? "Refunding…" : cancelBooking ? "Refund and cancel" : "Record refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
