"use client";

import { TriangleAlertIcon } from "lucide-react";

import type { WaitlistLead } from "@/lib/db/queries/waitlist-leads";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface LeadDeleteDialogProps {
  leads: WaitlistLead[] | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (leads: WaitlistLead[]) => void;
}

export function LeadDeleteDialog({
  leads,
  onOpenChange,
  onConfirm,
}: LeadDeleteDialogProps) {
  const count = leads?.length ?? 0;
  const single = count === 1 ? leads?.[0] : undefined;

  return (
    <AlertDialog open={count > 0} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <span
            aria-hidden="true"
            className="mb-1 grid size-10 place-items-center rounded-full bg-danger-wash text-danger-ink"
          >
            <TriangleAlertIcon className="size-5" />
          </span>
          <AlertDialogTitle>
            {single
              ? `Delete ${single.firstName} ${single.lastName}?`
              : `Delete ${count} people from the waitlist?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {single
              ? "This removes their name, email, mobile number and date of birth from the waitlist. It cannot be undone."
              : "This removes every selected person's name, email, mobile number and date of birth from the waitlist. It cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!single && count > 0 && (
          <ScrollArea className="max-h-56 rounded-(--radius-card) border border-border bg-surface-sunken">
            <ul className="divide-y divide-border">
              {leads?.map((lead) => (
                <li key={lead.id} className="px-3 py-2">
                  <p className="truncate text-console-body text-text-primary">
                    {lead.firstName} {lead.lastName}
                  </p>
                  <p className="truncate text-micro text-text-muted">
                    {lead.email}
                  </p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel className="wellplace-button h-tap rounded-(--radius-button) px-4">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="wellplace-button h-tap rounded-(--radius-button) px-4"
            onClick={() => {
              if (leads?.length) onConfirm(leads);
            }}
          >
            {single ? "Delete" : `Delete ${count}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
