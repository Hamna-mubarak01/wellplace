import { Badge } from "@/components/ui/badge";
import type { SuiteStatus } from "@/components/console/reception/board-types";
export { SUITE_STATUSES, NEVER_AUTO_ALLOCATED } from "@/lib/config/suite-status";

const LABEL: Readonly<Record<SuiteStatus, string>> = {
  available: "Available",
  checkout_hold: "Held",
  booked: "Booked",
  checked_in: "Checked in",
  cleaning: "Cleaning",
  blocked: "Blocked",
  maintenance: "Maintenance",
  not_ready: "Not ready",
  out_of_service: "Out of service",
};

const TONE: Readonly<Record<SuiteStatus, string>> = {
  available: "border-success-border bg-success-wash text-success-ink",
  checkout_hold: "border-warning-border bg-warning-wash text-warning-ink",
  booked: "border-brand bg-brand-wash text-text-primary",
  checked_in: "border-success-border bg-success-wash text-success-ink",
  cleaning: "border-info-border bg-info-wash text-info-ink",
  blocked: "border-danger-border bg-danger-wash text-danger-ink",
  maintenance: "border-warning-border bg-warning-wash text-warning-ink",
  not_ready: "border-warning-border bg-warning-wash text-warning-ink",
  out_of_service: "border-danger-border bg-danger-wash text-danger-ink",
};

export function suiteStatusLabel(status: SuiteStatus): string {
  return LABEL[status];
}

export function SuiteStatusBadge({ status }: { status: SuiteStatus }) {
  return (
    <Badge variant="outline" className={`w-fit max-w-full whitespace-normal text-left text-micro ${TONE[status]}`}>
      {LABEL[status]}
    </Badge>
  );
}
