import { StatusChip } from "@/components/console/shared/status-chip";
import {
  BOOKING_STATUS_TONE,
  bookingStatusLabel,
} from "@/components/console/manage/bookings/booking-model";
import type { BookingStatus } from "@/lib/domain/booking";

export interface BookingStatusChipProps {
  status: BookingStatus;
}

export function BookingStatusChip({ status }: BookingStatusChipProps) {
  return <StatusChip tone={BOOKING_STATUS_TONE[status]}>{bookingStatusLabel(status)}</StatusChip>;
}
