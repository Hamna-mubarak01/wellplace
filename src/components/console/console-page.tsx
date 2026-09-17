import type { ReactNode } from "react";

import { ConsolePageHeader } from "@/components/console/shared/console-page-header";
import { cn } from "@/lib/utils";

export interface ConsolePageProps {
  title: string;
  titleAction?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  meta?: readonly ReactNode[];
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ConsolePage({
  title,
  titleAction,
  actions,
  backHref,
  backLabel,
  meta,
  status,
  children,
  className,
}: ConsolePageProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-console flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
        className,
      )}
    >
      <ConsolePageHeader
        title={title}
        titleAction={titleAction}
        actions={actions}
        backHref={backHref}
        backLabel={backLabel}
        meta={meta}
        status={status}
      />

      {children}
    </div>
  );
}
