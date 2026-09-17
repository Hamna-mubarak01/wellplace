import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Button as ShadcnButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const wellplaceButtonVariants = cva(
  "wellplace-button rounded-(--radius-button) gap-(--space-button-gap)",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-brand text-on-brand shadow-(--shadow-sm) hover:bg-brand-hover hover:text-on-brand",
        outline:
          "border-border-interactive bg-surface-raised text-text-primary hover:border-border-hover hover:bg-surface-hover hover:text-text-primary",
        secondary:
          "border-transparent bg-surface-sunken text-text-primary hover:bg-surface-hover hover:text-text-primary",
        ghost:
          "border-transparent bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary",
        destructive:
          "border-transparent bg-danger text-on-brand hover:bg-danger-hover hover:text-on-brand",
        link: "h-auto min-h-0 border-transparent bg-transparent px-0 py-0 text-brand shadow-none hover:bg-transparent hover:text-brand-hover",
      },
      size: {
        default: "h-control px-(--space-button-inline) text-control",
        tile: "h-button-tile flex-col px-3 py-3 text-small",
        xs: "h-tap px-(--space-button-inline-sm) text-micro",
        sm: "h-tap px-(--space-button-inline-sm) text-fine",
        lg: "h-control px-(--space-button-inline-lg) text-body",
        nav: "h-tap px-(--space-button-inline) text-small",
        edge: "h-booking-edge-h w-booking-edge-w gap-0 p-0 text-label",
        icon: "size-tap gap-0 p-0",
        "icon-xs": "size-tap gap-0 p-0",
        "icon-sm": "size-tap gap-0 p-0",
        "icon-lg": "size-tap gap-0 p-0",
        theme:
          "h-tap w-(--measure-theme-switch-w) gap-0 p-(--space-theme-switch-inset)",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = Omit<
  ComponentProps<typeof ShadcnButton>,
  "variant" | "size"
> &
  VariantProps<typeof wellplaceButtonVariants> & {
    hoverEffect?: "simple" | "sweep";
    tone?: "accent" | "band-accent" | "band-scrim" | "brand" | "danger" | "edge" | "nav" | "plain" | "scrim";
  };

export function Button({
  className,
  variant = "default",
  size = "default",
  tone,
  hoverEffect,
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton
      variant={null}
      size={null}
      data-variant={variant}
      data-size={size}
      data-tone={tone}
      data-hover={
        hoverEffect ??
        (size === "xs" ||
        size === "sm" ||
        size?.startsWith("icon") ||
        variant === "ghost" ||
        variant === "link" ||
        variant === "destructive" ||
        tone === "danger" ||
        props["aria-pressed"] !== undefined
          ? "simple"
          : "sweep")
      }
      className={cn(wellplaceButtonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { wellplaceButtonVariants };
