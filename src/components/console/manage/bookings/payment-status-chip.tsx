import { StatusChip } from "@/components/console/shared/status-chip";
import {
  PAYMENT_STATUS_TONE,
  paymentStatusLabel,
} from "@/components/console/manage/bookings/booking-model";
import type { PaymentStatus } from "@/components/console/reception/booking-filters";

export interface PaymentStatusChipProps {
  status: PaymentStatus;
}

export function PaymentStatusChip({ status }: PaymentStatusChipProps) {
  return <StatusChip tone={PAYMENT_STATUS_TONE[status]}>{paymentStatusLabel(status)}</StatusChip>;
}
