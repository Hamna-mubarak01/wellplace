"use client";

import { useId } from "react";

import type { FilterOption } from "@/components/console/shared/filter-types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface FilterPeriodProps {
  label: string;
  labelHidden?: boolean;
  options: readonly FilterOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function FilterPeriod({
  label,
  labelHidden = false,
  options,
  value,
  onValueChange,
  disabled = false,
  className,
}: FilterPeriodProps) {
  const labelId = useId();

  return (
    <div className={cn("flex max-w-full min-w-0 flex-wrap items-center gap-2", className)}>
      <span
        id={labelId}
        className={cn("text-console-label tracking-label whitespace-nowrap text-text-muted uppercase", labelHidden && "sr-only")}
      >
        {label}
      </span>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={value}
        disabled={disabled}
        aria-labelledby={labelId}
        onValueChange={(next) => {
          if (next) onValueChange(next);
        }}
        className="max-w-full overflow-x-auto overscroll-x-contain"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="h-control min-w-tap shrink-0 border-border-interactive bg-surface-raised px-3 text-console-body text-text-secondary hover:bg-surface-hover hover:text-text-primary data-[state=on]:bg-brand data-[state=on]:font-medium data-[state=on]:text-on-brand data-[state=on]:hover:bg-brand data-[state=on]:hover:text-on-brand"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
