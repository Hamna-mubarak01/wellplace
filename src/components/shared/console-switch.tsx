"use client";

import type { ComponentProps } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface ConsoleSwitchProps extends Omit<
  ComponentProps<typeof Switch>,
  "id" | "size"
> {
  id: string;
  tapAreaClassName?: string;
}

export function ConsoleSwitch({
  id,
  className,
  tapAreaClassName,
  disabled,
  ...props
}: ConsoleSwitchProps) {
  return (
    <label
      htmlFor={id}
      data-tap-area="console-switch"
      data-disabled={disabled ? "" : undefined}
      className={cn(
        "inline-flex min-h-tap min-w-tap shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-(--radius-control) data-disabled:cursor-not-allowed",
        tapAreaClassName,
      )}
    >
      <Switch id={id} disabled={disabled} className={className} {...props} />
    </label>
  );
}
