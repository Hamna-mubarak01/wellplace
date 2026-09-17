import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const CONSOLE_SURFACE =
  "rounded-(--radius-card) border border-border bg-surface-raised";

export function ConsoleCard({ className, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "gap-0 rounded-(--radius-card) border border-border bg-surface-raised py-0 shadow-none ring-0",
        className,
      )}
      {...props}
    />
  );
}

export function ConsoleCardBody({
  className,
  ...props
}: ComponentProps<typeof CardContent>) {
  return <CardContent className={cn("px-4 py-4", className)} {...props} />;
}

export interface ConsoleSectionProps {
  title: string;
  Icon?: LucideIcon;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ConsoleSection({
  title,
  Icon,
  count,
  action,
  children,
  className,
}: ConsoleSectionProps) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex min-h-tap flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="flex min-w-0 items-center gap-2 text-console-body font-medium text-text-primary">
          {Icon && (
            <Icon aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
          )}
          <span className="truncate">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 font-data text-micro tabular-nums text-text-secondary">
              {count}
            </span>
          )}
        </h2>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export interface ConsoleEmptyProps {
  title: string;
  description?: string;
  Icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function ConsoleEmpty({
  title,
  description,
  Icon,
  action,
  className,
}: ConsoleEmptyProps) {
  return (
    <div
      className={cn(
        CONSOLE_SURFACE,
        "flex min-h-console-panel flex-col items-center justify-center gap-1 px-4 py-8 text-center",
        className,
      )}
    >
      {Icon && (
        <Icon aria-hidden="true" className="mb-1 size-5 shrink-0 text-text-muted" />
      )}
      <p className="text-console-body font-medium text-text-primary">{title}</p>
      {description && (
        <p className="max-w-prose text-console-body text-pretty text-text-secondary">
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export const CONSOLE_ROW =
  "flex min-h-console-row flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-(--radius-card) border border-border bg-surface-raised px-4 py-3";

export type ConsoleNoticeTone = "info" | "warning" | "neutral";

const NOTICE_TONE: Readonly<Record<ConsoleNoticeTone, string>> = {
  info: "border-info-border bg-info-wash text-info-ink",
  warning: "border-warning-border bg-warning-wash text-warning-ink",
  neutral: "border-border bg-surface-raised text-text-secondary",
};

export interface ConsoleNoticeProps {
  tone?: ConsoleNoticeTone;
  Icon?: LucideIcon;
  role?: "alert" | "status" | "note";
  children: ReactNode;
  className?: string;
}

export function ConsoleNotice({
  tone = "warning",
  Icon,
  role = "status",
  children,
  className,
}: ConsoleNoticeProps) {
  return (
    <Alert
      role={role}
      className={cn(
        "rounded-(--radius-card) px-4 py-3",
        NOTICE_TONE[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" />}
      <AlertDescription className="text-console-body text-current">
        {children}
      </AlertDescription>
    </Alert>
  );
}
