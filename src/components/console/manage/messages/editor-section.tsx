"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon, type LucideIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface EditorSectionProps {
  title: string;
  Icon: LucideIcon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function EditorSection({
  title,
  Icon,
  open,
  onOpenChange,
  badge,
  children,
  className,
}: EditorSectionProps) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className={cn("min-w-0 border-b border-border", className)}
    >
      <h2 className="min-w-0">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            hoverEffect="simple"
            className="w-full justify-between rounded-none px-4 text-console-body font-medium"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Icon
                aria-hidden="true"
                className="size-4 shrink-0 text-text-muted"
              />
              <span className="truncate">{title}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {badge}
              <ChevronDownIcon
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none",
                  open && "rotate-180",
                )}
              />
            </span>
          </Button>
        </CollapsibleTrigger>
      </h2>

      <CollapsibleContent className="px-4 pt-1 pb-5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
