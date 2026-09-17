import Link from "next/link";
import { FileMinusIcon } from "lucide-react";

import { ConsolePage } from "@/components/console/console-page";
import { ConsoleEmpty } from "@/components/console/console-surface";
import { Button } from "@/components/shared/button";
import { FINANCE_PATH } from "@/lib/config/finance";

export default function FinanceCreditNoteNotFound() {
  return (
    <ConsolePage title="Credit note not found" backHref={FINANCE_PATH.invoices} backLabel="Back to invoices">
      <ConsoleEmpty
        Icon={FileMinusIcon}
        title="This credit note does not exist"
        description="Check the link, or find the credit note by its number in the invoice list."
        action={
          <Button asChild variant="outline">
            <Link href={`${FINANCE_PATH.invoices}?type=credit_note`}>Open credit notes</Link>
          </Button>
        }
      />
    </ConsolePage>
  );
}
