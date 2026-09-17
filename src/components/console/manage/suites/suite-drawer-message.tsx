import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { SheetClose, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export interface SuiteDrawerMessageProps {
  title: string;
  description: string;
  Icon: LucideIcon;
  tone?: "neutral" | "danger";
}

export function SuiteDrawerMessage({ title, description, Icon, tone = "neutral" }: SuiteDrawerMessageProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className="flex min-h-0 flex-1 flex-col items-start gap-3 p-5 pt-6"
    >
      <Icon
        aria-hidden="true"
        className={tone === "danger" ? "size-5 shrink-0 text-danger-ink" : "size-5 shrink-0 text-text-muted"}
      />
      <SheetTitle className="pr-dialog-close font-body text-console-title font-medium text-text-primary">
        {title}
      </SheetTitle>
      <SheetDescription className="max-w-prose text-console-body text-pretty text-text-secondary">
        {description}
      </SheetDescription>
      <SheetClose asChild>
        <Button type="button" variant="outline" className="mt-2">
          Close
        </Button>
      </SheetClose>
    </div>
  );
}
