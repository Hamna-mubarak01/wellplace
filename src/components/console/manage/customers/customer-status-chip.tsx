import { RepeatIcon, UserPlusIcon, UserRoundIcon, type LucideIcon } from "lucide-react";

import type { CustomerStatus, CustomerStatusId } from "@/components/console/manage/customers/customer-view";
import { StatusChip } from "@/components/console/shared/status-chip";

const STATUS_ICON: Readonly<Record<CustomerStatusId, LucideIcon>> = {
  lead: UserPlusIcon,
  customer: UserRoundIcon,
  returning: RepeatIcon,
};

export interface CustomerStatusChipProps {
  status: CustomerStatus;
}

export function CustomerStatusChip({ status }: CustomerStatusChipProps) {
  return (
    <StatusChip tone={status.tone} Icon={STATUS_ICON[status.id]}>
      {status.label}
    </StatusChip>
  );
}
