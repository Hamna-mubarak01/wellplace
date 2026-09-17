"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmReturnedRefund } from "@/app/(console)/manage/finance/actions";
import { PAYMENT_REFERENCE_MAX_LENGTH } from "@/lib/config/console-limits";
import { runAction } from "@/lib/console/run-action";
import { formatAed } from "@/components/shared/money";
import { Button } from "@/components/shared/button";
import { ReasonField } from "@/components/shared/reason-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function ConfirmRefundDialog({ refundId, amountFils }: { refundId: string; amountFils: number }) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [returned, setReturned] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  function changeOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) { setReference(""); setReason(""); setReturned(false); }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm" hoverEffect="sweep">Confirm returned {formatAed(amountFils)}</Button></DialogTrigger>
    <DialogContent className="max-h-dialog-max-h overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Confirm the money was returned</DialogTitle><DialogDescription>Use this after completing the {formatAed(amountFils)} refund through the original payment method. This updates the record and does not send money.</DialogDescription></DialogHeader>
      <Field><FieldLabel htmlFor={`refund-reference-${refundId}`}>Refund transaction or receipt reference</FieldLabel><Input id={`refund-reference-${refundId}`} value={reference} onChange={(event) => setReference(event.target.value)} maxLength={PAYMENT_REFERENCE_MAX_LENGTH} disabled={pending} /></Field>
      <ReasonField id={`refund-confirm-reason-${refundId}`} value={reason} onChange={setReason} disabled={pending} />
      <label className="flex min-h-tap items-start gap-3 text-console-body"><Checkbox checked={returned} onCheckedChange={(value) => setReturned(value === true)} disabled={pending} /><span>I have checked that the guest received this refund.</span></label>
      <DialogFooter><Button variant="outline" disabled={pending} onClick={() => changeOpen(false)}>Cancel</Button><Button disabled={pending} onClick={() => start(async () => {
        if (await runAction(() => confirmReturnedRefund({ refundId, reference, reason, returned }), "Refund marked as returned")) { setOpen(false); router.refresh(); }
      })}>{pending ? "Saving…" : "Confirm return"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
