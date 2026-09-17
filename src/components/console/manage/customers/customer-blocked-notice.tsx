import { BanIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function CustomerBlockedNotice({ isBlocked }: { isBlocked: boolean }) {
  if (!isBlocked) return null;

  return (
    <Alert role="note" className="rounded-(--radius-card) border-danger-border bg-danger-wash px-4 py-3 text-danger-ink">
      <BanIcon aria-hidden="true" />
      <AlertTitle className="text-console-body font-semibold">Blocked from booking</AlertTitle>
      <AlertDescription className="text-console-body text-current">
        New bookings are refused online and at Reception.
      </AlertDescription>
    </Alert>
  );
}
