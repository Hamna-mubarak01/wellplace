"use client";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";

import { withdrawRefund } from "@/app/(console)/refund-actions";
import type { BookingActionResult } from "@/app/(console)/reception/actions";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { formatAed } from "@/components/shared/money";
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
import { ReasonField } from "@/components/console/reception/reception-reason-field";

export interface WithdrawRefundDialogProps {
  bookingId: string;
  refundId: string;
  amountFils: number;
}

export function WithdrawRefundDialog({ bookingId, refundId, amountFils }: WithdrawRefundDialogProps) {
  const router = useRouter();
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const fieldId = `withdraw-refund-reason-${refundId}`;

  const close = () => {
    setOpen(false);
    setReason("");
  };

  const submit = () => {
    if (pending) return;
    if (reason.trim().length === 0) {
      reject(fieldId, "Enter a reason for withdrawing this refund.");
      return;
    }
    start(async () => {
      let result: BookingActionResult;
      try {
        result = await withdrawRefund({ bookingId, refundId, reason });
      } catch (cause) {
        console.error("[console] withdrawRefund threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }
      if (result.ok) {
        toast.success("Refund request withdrawn");
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
        if (next) setOpen(true);
        else close();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" hoverEffect="sweep">
          Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent pending={pending} className="max-h-dialog-max-h overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw this refund request?</DialogTitle>
          <DialogDescription>
            {formatAed(amountFils)} has not been returned yet. Withdrawing it makes that amount refundable again and closes the pending refund alert.
          </DialogDescription>
        </DialogHeader>

        <ReasonField id={fieldId} value={reason} onChange={setReason} disabled={pending} />

        <DialogFooter>
          <Button type="button" variant="ghost" hoverEffect="sweep" onClick={close} disabled={pending}>
            Keep the request
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Withdrawing…" : "Withdraw refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
