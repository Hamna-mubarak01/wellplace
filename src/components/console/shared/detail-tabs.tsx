import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface DetailTab {
  readonly value: string;
  readonly label: string;
  readonly count?: number;
  readonly content: ReactNode;
}

export interface DetailTabsProps {
  label: string;
  tabs: readonly DetailTab[];
  defaultValue?: string;
  className?: string;
}

export function DetailTabs({ label, tabs, defaultValue, className }: DetailTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <Tabs defaultValue={defaultValue ?? tabs[0].value} className={cn("min-w-0 gap-4", className)}>
      <div className="min-w-0 overflow-x-auto border-b border-border pt-1">
        <TabsList variant="line" aria-label={label} className="h-auto! justify-start gap-1 px-0 pt-0 pb-1.5">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="min-h-tap flex-none px-4 text-console-body text-text-secondary after:bg-brand hover:text-text-primary data-active:text-text-primary"
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="font-data text-micro tabular-nums text-text-muted">
                  {tab.count.toLocaleString("en-AE")}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="min-w-0 text-console-body">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
