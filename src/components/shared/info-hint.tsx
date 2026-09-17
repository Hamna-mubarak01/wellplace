"use client";

import { useRef, useState } from "react";
import { InfoIcon } from "lucide-react";
import { Button } from "@/components/shared/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface InfoHintProps {
  label: string;
  children: string;
}

function openedByQuietFocus(trigger: HTMLElement | null): boolean {
  return (
    trigger !== null &&
    trigger.ownerDocument.activeElement === trigger &&
    !trigger.matches(":focus-visible") &&
    !trigger.matches(":hover")
  );
}

export function InfoHint({ label, children }: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const openBeforePress = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => {
        if (next && openedByQuietFocus(trigger.current)) return;
        setOpen(next);
      }}
    >
      <TooltipTrigger
        ref={trigger}
        asChild
        onPointerDown={() => { openBeforePress.current = open; }}
        onClick={(event) => {
          event.preventDefault();
          setOpen(event.detail === 0 ? !open : !openBeforePress.current);
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`About ${label}`}
          className="shrink-0 rounded-full"
        >
          <InfoIcon aria-hidden="true" className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="max-h-(--radix-tooltip-content-available-height) max-w-info-hint items-start overflow-y-auto rounded-(--radius-card) border border-border bg-surface-raised px-3.5 py-2.5 text-console-body leading-relaxed text-pretty text-text-primary shadow-(--shadow-md) [&_svg]:bg-surface-raised [&_svg]:fill-surface-raised"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
