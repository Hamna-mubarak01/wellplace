import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusChipTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const TONE_CLASS: Readonly<Record<StatusChipTone, string>> = {
  neutral: "border-border-strong bg-surface-sunken text-text-secondary",
  brand: "border-brand bg-brand-wash text-text-primary",
  success: "border-success-border bg-success-wash text-success-ink",
  warning: "border-warning-border bg-warning-wash text-warning-ink",
  danger: "border-danger-border bg-danger-wash text-danger-ink",
  info: "border-info-border bg-info-wash text-info-ink",
};

export interface StatusChipProps {
  tone?: StatusChipTone;
  Icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

export function StatusChip({ tone = "neutral", Icon, children, className }: StatusChipProps) {
  return (
    <Badge
      variant="outline"
      data-tone={tone}
      className={cn(
        "h-auto min-h-6 gap-1 rounded-full px-2 py-0.5 text-micro font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </Badge>
  );
}
