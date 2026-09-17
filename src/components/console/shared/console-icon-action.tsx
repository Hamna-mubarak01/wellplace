import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button, type ButtonProps } from "@/components/shared/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ConsoleIconActionProps = Omit<
  ButtonProps,
  "variant" | "size" | "asChild" | "children" | "hoverEffect" | "aria-label"
> & {
  label: string;
  Icon: LucideIcon;
  href?: string;
  variant?: "outline" | "ghost";
};

export function ConsoleIconAction({
  label,
  Icon,
  href,
  variant = "outline",
  ...buttonProps
}: ConsoleIconActionProps) {
  const icon = <Icon aria-hidden="true" className="size-4" />;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Button asChild variant={variant} size="icon" aria-label={label} {...buttonProps}>
            <Link href={href}>{icon}</Link>
          </Button>
        ) : (
          <Button type="button" variant={variant} size="icon" aria-label={label} {...buttonProps}>
            {icon}
          </Button>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
