"use client";

import type { ComponentProps } from "react";
import { DialogContent as Content } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function DialogContent({ pending = false, className, onInteractOutside, onEscapeKeyDown, showCloseButton = true, ...props }: ComponentProps<typeof Content> & { pending?: boolean }) {
  return <Content
    {...props}
    data-reception-dialog=""
    aria-busy={pending || undefined}
    className={cn("max-h-dialog-max-h overflow-y-auto overscroll-contain", className)}
    showCloseButton={showCloseButton && !pending}
    onInteractOutside={(event) => {
      if (pending || (event.target instanceof Element && event.target.closest("[data-sonner-toast]"))) event.preventDefault();
      onInteractOutside?.(event);
    }}
    onEscapeKeyDown={(event) => {
      if (pending) event.preventDefault();
      onEscapeKeyDown?.(event);
    }}
  />;
}
