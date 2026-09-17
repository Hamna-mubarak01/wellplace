import Link from "next/link";
import { UserXIcon } from "lucide-react";

import { ConsolePage } from "@/components/console/console-page";
import { ConsoleEmpty } from "@/components/console/console-surface";
import { Button } from "@/components/shared/button";

export default function CustomerNotFound() {
  return (
    <ConsolePage title="Customer not found" backHref="/manage/customers" backLabel="Back to customers">
      <ConsoleEmpty
        Icon={UserXIcon}
        title="No customer matches this link"
        description="The link may be out of date. Find the guest in the customer list instead."
        action={
          <Button asChild variant="outline">
            <Link href="/manage/customers">Go to customers</Link>
          </Button>
        }
      />
    </ConsolePage>
  );
}
