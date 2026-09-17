"use client";

import { LayoutGridIcon, ListIcon } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type MessageListView = "list" | "grid";

export interface MessageViewToggleProps {
  view: MessageListView;
  onViewChange: (view: MessageListView) => void;
  className?: string;
}

const ITEM =
  "h-control w-control shrink-0 cursor-pointer rounded-(--radius-control) border border-border bg-surface-raised text-text-primary transition-colors duration-150 hover:border-brand hover:bg-surface-hover data-[state=on]:border-brand data-[state=on]:bg-brand-wash data-[state=on]:text-brand motion-reduce:transition-none";

export function MessageViewToggle({
  view,
  onViewChange,
  className,
}: MessageViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={view}
      aria-label="How the templates are shown"
      onValueChange={(next) => {
        if (next === "list" || next === "grid") onViewChange(next);
      }}
      className={cn("gap-2 rounded-none", className)}
    >
      <ToggleGroupItem
        value="list"
        aria-label="Show as a table"
        className={ITEM}
      >
        <ListIcon aria-hidden="true" className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label="Show as cards" className={ITEM}>
        <LayoutGridIcon aria-hidden="true" className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
