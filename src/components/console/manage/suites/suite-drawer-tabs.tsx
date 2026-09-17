"use client";

import { useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import {
  SUITE_TABS,
  SUITE_TAB_LABEL,
  parseSuiteTab,
  tabParam,
  type SuiteTab,
} from "@/app/(console)/manage/suites/suite-detail-view";
import { SUITE_TAB_PARAM } from "@/app/(console)/manage/suites/suites-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface SuiteDrawerTabsProps {
  panels: Readonly<Record<SuiteTab, ReactNode>>;
}

export function SuiteDrawerTabs({ panels }: SuiteDrawerTabsProps) {
  const tab = parseSuiteTab(useSearchParams().get(SUITE_TAB_PARAM));
  const body = useRef<HTMLDivElement>(null);

  function select(value: string) {
    const next = new URLSearchParams(window.location.search);
    const param = tabParam(parseSuiteTab(value));
    if (param === null) next.delete(SUITE_TAB_PARAM);
    else next.set(SUITE_TAB_PARAM, param);
    const query = next.toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
    body.current?.scrollTo({ top: 0 });
  }

  return (
    <Tabs value={tab} onValueChange={select} className="min-h-0 flex-1 gap-0">
      <div className="shrink-0 overflow-x-auto border-b border-border px-5 pt-1">
        <TabsList variant="line" aria-label="Suite sections" className="h-auto! justify-start gap-1 px-0 pt-0 pb-1.5">
          {SUITE_TABS.map((value) => (
            <TabsTrigger
              key={value}
              value={value}
              className="min-h-tap flex-none px-4 text-console-body text-text-secondary after:bg-brand hover:text-text-primary data-active:text-text-primary"
            >
              {SUITE_TAB_LABEL[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div ref={body} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {SUITE_TABS.map((value) => (
          <TabsContent key={value} value={value} className="flex min-w-0 flex-col gap-6 p-5 text-console-body">
            {panels[value]}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
