"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BOARD_VIEW_LABEL, type BoardView } from "@/components/console/reception/board-view-config";
export { BOARD_VIEWS, BOARD_VIEW_LABEL, isBoardView, type BoardView } from "@/components/console/reception/board-view-config";
export interface BoardViewTabsProps { current: BoardView; date: string; preview?: boolean }
const VISIBLE_VIEWS = ["day", "week", "month"] as const;

export function BoardViewTabs({ current, date, preview = false }: BoardViewTabsProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, select] = useOptimistic(current);
  const href = (view: string) => `/reception?view=${view}&date=${date}${preview ? "&preview=1" : ""}`;
  return (
    <div className="contents" data-reception-navigating={pending}>
      <Tabs value={selected === "timeline" ? "day" : selected} onValueChange={(view) => start(() => { select(view as BoardView); router.push(href(view), { scroll: false }); })} className="reception-schedule-views min-w-0">
        <TabsList aria-label="Schedule view" className="reception-view-list h-auto! w-full gap-1 bg-surface-sunken p-1">
          {VISIBLE_VIEWS.map((view) => {
            return <TabsTrigger key={view} value={view} onPointerEnter={(event) => { if (event.pointerType === "mouse" && current !== view) router.prefetch(href(view)); }} onFocus={() => { if (current !== view) router.prefetch(href(view)); }} className="h-auto! min-h-tap min-w-max flex-auto px-2 sm:px-3 text-fine whitespace-nowrap data-[state=active]:bg-surface-raised data-[state=active]:text-text-primary">{BOARD_VIEW_LABEL[view]}{pending && selected === view && <LoaderCircleIcon aria-hidden="true" className="size-3 motion-safe:animate-spin" />}</TabsTrigger>;
          })}
        </TabsList>
      </Tabs>
      {pending && <span role="status" className="sr-only">Loading {BOARD_VIEW_LABEL[selected].toLowerCase()} schedule…</span>}

    </div>
  );
}
