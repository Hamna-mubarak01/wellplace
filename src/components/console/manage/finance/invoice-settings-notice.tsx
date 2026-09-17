import Link from "next/link";
import { Settings2Icon, TriangleAlertIcon } from "lucide-react";

import { ConsoleNotice } from "@/components/console/console-surface";
import { Button } from "@/components/shared/button";
import { FINANCE_PATH } from "@/lib/config/finance";
import { INVOICE_COPY } from "@/lib/config/invoice";

export interface InvoiceSettingsNoticeProps {
  message?: string;
  className?: string;
}

export function InvoiceSettingsNotice({
  message = INVOICE_COPY.console.issuerIncomplete,
  className,
}: InvoiceSettingsNoticeProps) {
  return (
    <ConsoleNotice tone="warning" Icon={TriangleAlertIcon} role="status" className={className}>
      <div className="flex flex-col items-start gap-3">
        <p className="text-pretty">{message}</p>
        <Button asChild variant="outline" size="sm">
          <Link href={FINANCE_PATH.invoiceSettings}>
            <Settings2Icon aria-hidden="true" className="size-4" />
            {INVOICE_COPY.console.openSettings}
          </Link>
        </Button>
      </div>
    </ConsoleNotice>
  );
}
