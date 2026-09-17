"use client";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";

import { revokeReceipt } from "@/app/(console)/refund-actions";
import type { BookingActionResult } from "@/app/(console)/reception/actions";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
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

export interface RevokeReceiptDialogProps {
  bookingId: string;
}

export function RevokeReceiptDialog({ bookingId }: RevokeReceiptDialogProps) {
  const router = useRouter();
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const fieldId = `revoke-receipt-reason-${bookingId}`;

  const close = () => {
    setOpen(false);
    setReason("");
  };

  const submit = () => {
    if (pending) return;
    if (reason.trim().length === 0) {
      reject(fieldId, "Enter a reason for withdrawing the receipt link.");
      return;
    }
    start(async () => {
      let result: BookingActionResult;
      try {
        result = await revokeReceipt({ bookingId, reason });
      } catch (cause) {
        console.error("[console] revokeReceipt threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }
      if (result.ok) {
        toast.success("Receipt link withdrawn");
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
          Withdraw receipt link
        </Button>
      </DialogTrigger>
      <DialogContent pending={pending} className="max-h-dialog-max-h overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw the guest&rsquo;s receipt link?</DialogTitle>
          <DialogDescription>
            The link in the guest&rsquo;s confirmation email will stop opening. Use this if it was sent to the wrong person or shared by mistake. The booking and its payments are not changed.
          </DialogDescription>
        </DialogHeader>

        <ReasonField id={fieldId} value={reason} onChange={setReason} disabled={pending} />

        <DialogFooter>
          <Button type="button" variant="ghost" hoverEffect="sweep" onClick={close} disabled={pending}>
            Keep the link
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Withdrawing…" : "Withdraw link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
