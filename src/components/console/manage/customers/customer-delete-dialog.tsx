"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon, TriangleAlertIcon } from "lucide-react";

import { deleteCustomerRecord, type CustomerRecordResult } from "@/app/(console)/manage/customers/actions";
import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";

export interface CustomerDeleteDialogProps {
  readonly customer: { readonly id: string; readonly name: string };
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly redirectTo?: string;
}

export function CustomerDeleteDialog({ customer, open: controlledOpen, onOpenChange, redirectTo }: CustomerDeleteDialogProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ownOpen, setOwnOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : ownOpen;

  function changeOpen(next: boolean) {
    if (pending) return;
    if (next) setFailure(null);
    if (!controlled) setOwnOpen(next);
    onOpenChange?.(next);
  }

  function confirm() {
    if (pending) return;
    setFailure(null);
    start(async () => {
      let result: CustomerRecordResult;
      try {
        result = await deleteCustomerRecord({ customerId: customer.id });
      } catch (cause) {
        console.error("[manage] deleteCustomerRecord could not be confirmed:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      toast.success(`${customer.name} deleted`);
      if (!controlled) setOwnOpen(false);
      onOpenChange?.(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      {!controlled && (
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" tone="danger">
            <Trash2Icon aria-hidden="true" className="size-4" />
            Delete
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <span aria-hidden="true" className="mb-1 grid size-10 place-items-center rounded-full bg-danger-wash text-danger-ink">
            <TriangleAlertIcon className="size-5" />
          </span>
          <AlertDialogTitle>{`Delete ${customer.name}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            This removes their customer record, notes and tags. It cannot be undone. A customer with bookings or messages on record
            cannot be deleted; block them instead.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {failure !== null && <ActionError title="Nothing was deleted" message={failure} />}

        <AlertDialogFooter>
          <AlertDialogCancel className="wellplace-button h-tap rounded-(--radius-button) px-4" disabled={pending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="wellplace-button h-tap rounded-(--radius-button) px-4"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              confirm();
            }}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
