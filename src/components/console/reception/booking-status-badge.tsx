import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/domain/booking";
import {
  STATUS_TONE,
  STATUS_TONE_CLASS,
  statusLabel,
} from "@/components/console/reception/booking-format";

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge
      variant="outline"
      className={`text-micro ${STATUS_TONE_CLASS[STATUS_TONE[status]]}`}
    >
      {statusLabel(status)}
    </Badge>
  );
}
