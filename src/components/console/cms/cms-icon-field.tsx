"use client";

import { CheckIcon } from "lucide-react";

import { ContentIcon } from "@/components/shared/content-icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CONTENT_ICONS } from "@/lib/config/cms/icons";
import { cn } from "@/lib/utils";

export function CmsIconField({
  value,
  onChange,
  labelledBy,
}: {
  value: string;
  onChange: (next: string) => void;
  labelledBy?: string;
}) {
  return (
    <ScrollArea className="max-h-icon-grid rounded-(--radius-control) border border-border bg-surface-base">
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        className="grid grid-cols-[repeat(auto-fit,minmax(var(--spacing-tap),1fr))] gap-1 p-2"
      >
        {CONTENT_ICONS.map((icon) => {
          const selected = icon.value === value;
          return (
            <button
              key={icon.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={icon.label}
              title={icon.label}
              onClick={() => onChange(icon.value)}
              className={cn(
                "relative grid size-tap place-items-center rounded-(--radius-control) border transition-colors",
                "focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
                selected
                  ? "border-brand bg-brand-wash text-brand"
                  : "border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary",
              )}
            >
              <ContentIcon name={icon.value} className="size-5" />
              {selected && (
                <CheckIcon
                  aria-hidden="true"
                  className="absolute right-0.5 bottom-0.5 size-3 text-brand"
                />
              )}
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
