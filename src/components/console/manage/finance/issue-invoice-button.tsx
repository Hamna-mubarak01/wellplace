"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FilePlus2Icon, ReceiptTextIcon } from "lucide-react";

import {
  issueBookingInvoice,
  type IssueInvoiceResult,
  type IssuedInvoiceLink,
} from "@/app/(console)/manage/finance/invoices/actions";
import { InvoiceSettingsNotice } from "@/components/console/manage/finance/invoice-settings-notice";
import { Button } from "@/components/shared/button";
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { invoicePath } from "@/lib/config/finance";
import { INVOICE_COPY } from "@/lib/config/invoice";

export interface IssueInvoiceButtonProps {
  bookingId: string;
  existing?: { id: string; number: string } | null;
}

export function IssueInvoiceButton({ bookingId, existing = null }: IssueInvoiceButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [issued, setIssued] = useState<IssuedInvoiceLink | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const invoice = existing ?? issued;

  if (invoice) {
    return (
      <Button asChild variant="outline">
        <Link href={invoicePath(invoice.id)}>
          <ReceiptTextIcon aria-hidden="true" className="size-4" />
          View invoice {invoice.number}
        </Link>
      </Button>
    );
  }

  function issue() {
    if (pending) return;
    setBlocked(null);
    start(async () => {
      let result: IssueInvoiceResult;
      try {
        result = await issueBookingInvoice({ bookingId });
      } catch (cause) {
        console.error("[console] issueBookingInvoice threw:", cause);
        result = { ok: false, reason: "failed", message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        setIssued(result.invoice);
        toast.success(`Invoice ${result.invoice.number} issued`);
        router.refresh();
        return;
      }

      if (result.reason === "settings_incomplete") {
        setBlocked(result.message);
        return;
      }

      toast.error(INVOICE_COPY.console.issueFailed, { description: result.message });
    });
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-3">
      <Button type="button" onClick={issue} disabled={pending}>
        <FilePlus2Icon aria-hidden="true" className="size-4" />
        {pending ? "Issuing…" : "Issue invoice"}
      </Button>
      {blocked !== null && <InvoiceSettingsNotice message={blocked} />}
    </div>
  );
}
