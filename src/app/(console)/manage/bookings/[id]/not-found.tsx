import Link from "next/link";
import { SearchXIcon } from "lucide-react";

import { ConsolePage } from "@/components/console/console-page";
import { ConsoleEmpty } from "@/components/console/console-surface";
import { Button } from "@/components/shared/button";

export default function ManageBookingNotFound() {
  return (
    <ConsolePage title="Booking not found" backHref="/manage/bookings" backLabel="Back to bookings">
      <ConsoleEmpty
        Icon={SearchXIcon}
        title="This booking does not exist"
        description="The link may be mistyped, or the booking may belong to another address. Search for it by reference, name or email."
        action={
          <Button asChild variant="outline">
            <Link href="/manage/bookings">Search bookings</Link>
          </Button>
        }
      />
    </ConsolePage>
  );
}
