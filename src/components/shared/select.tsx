"use client";

import type { ComponentProps } from "react";
import { SelectContent as ShadcnSelectContent } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export {
  Select,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SelectContent({
  className,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof ShadcnSelectContent>) {
  return (
    <ShadcnSelectContent
      {...props}
      position="popper"
      align={align}
      side={side}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        "max-w-(--radix-select-content-available-width) data-[side=bottom]:translate-y-0 data-[side=top]:translate-y-0",
        className,
      )}
    />
  );
}
