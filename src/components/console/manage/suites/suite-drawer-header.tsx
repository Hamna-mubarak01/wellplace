import type { ReactNode } from "react";

import { StatusChip } from "@/components/console/shared/status-chip";
import { LIVE_STATE_TONE } from "@/components/console/manage/suites/suite-tones";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LIVE_STATE_LABEL, type LiveState } from "@/app/(console)/manage/suites/suites-view";

export interface SuiteDrawerHeaderProps {
  suiteNumber: number;
  name: string | null;
  status: LiveState;
  actions: ReactNode;
}

export function SuiteDrawerHeader({ suiteNumber, name, status, actions }: SuiteDrawerHeaderProps) {
  return (
    <SheetHeader className="@container shrink-0 gap-4 border-b border-border p-5">
      <div className="flex min-w-0 flex-col gap-1 pr-dialog-close">
        <div className="flex min-h-tap min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <SheetTitle className="font-body text-console-title font-medium text-text-primary">
            Suite {suiteNumber}
          </SheetTitle>
          <StatusChip tone={LIVE_STATE_TONE[status]}>{LIVE_STATE_LABEL[status]}</StatusChip>
        </div>
        <SheetDescription
          className={name === null ? "sr-only" : "truncate text-console-body text-text-secondary"}
        >
          {name ?? `Details, bookings and prices for suite ${suiteNumber}`}
        </SheetDescription>
      </div>
      {actions}
    </SheetHeader>
  );
}
