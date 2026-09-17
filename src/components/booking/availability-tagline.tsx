import { HourglassIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export interface AvailabilityTaglineProps {
  readonly message: string | null;
  readonly className?: string;
}

export function AvailabilityTagline({ message, className }: AvailabilityTaglineProps) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {message ? (
        <Alert
          role="none"
          className={cn(
            "border-warning-border bg-warning-wash text-warning-ink",
            className,
          )}
        >
          <HourglassIcon aria-hidden="true" />
          <AlertDescription className="text-small font-medium text-current">
            {message}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
