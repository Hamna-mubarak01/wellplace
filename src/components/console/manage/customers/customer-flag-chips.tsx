import { BanIcon, type LucideIcon } from "lucide-react";

import type { CustomerFlag, CustomerFlagId } from "@/components/console/manage/customers/customer-view";
import { StatusChip } from "@/components/console/shared/status-chip";

const FLAG_ICON: Readonly<Record<CustomerFlagId, LucideIcon>> = {
  blocked: BanIcon,
};

export interface CustomerFlagChipsProps {
  flags: readonly CustomerFlag[];
}

export function CustomerFlagChips({ flags }: CustomerFlagChipsProps) {
  if (flags.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {flags.map((flag) => (
        <StatusChip key={flag.id} tone={flag.tone} Icon={FLAG_ICON[flag.id]}>
          {flag.label}
        </StatusChip>
      ))}
    </span>
  );
}
