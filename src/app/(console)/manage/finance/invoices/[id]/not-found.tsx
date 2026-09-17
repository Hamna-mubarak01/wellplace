import Link from "next/link";
import { ReceiptTextIcon } from "lucide-react";

import { ConsolePage } from "@/components/console/console-page";
import { ConsoleEmpty } from "@/components/console/console-surface";
import { Button } from "@/components/shared/button";
import { FINANCE_PATH } from "@/lib/config/finance";

export default function FinanceInvoiceNotFound() {
  return (
    <ConsolePage title="Invoice not found" backHref={FINANCE_PATH.invoices} backLabel="Back to invoices">
      <ConsoleEmpty
        Icon={ReceiptTextIcon}
        title="This invoice does not exist"
        description="Check the link, or find the invoice by its number in the invoice list."
        action={
          <Button asChild variant="outline">
            <Link href={FINANCE_PATH.invoices}>Open invoices</Link>
          </Button>
        }
      />
    </ConsolePage>
  );
}
