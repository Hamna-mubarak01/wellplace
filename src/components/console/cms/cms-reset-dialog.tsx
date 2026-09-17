"use client";

import { useState } from "react";
import { RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CmsResetDialog({
  targetLabel,
  actionLabel = "Set to default",
  title,
  description,
  onReset,
  disabled,
  className,
}: {
  targetLabel: string;
  actionLabel?: string;
  title?: string;
  description: string;
  onReset: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        className={className}
        onClick={() => setOpen(true)}
      >
        <RotateCcwIcon aria-hidden="true" className="size-4" />
        {actionLabel}
      </Button>
      <DialogContent
        showCloseButton={false}
        className="max-h-dialog-max-h gap-5 overflow-y-auto bg-surface-raised p-4 text-center sm:max-w-sm sm:p-6"
      >
        <DialogHeader className="items-center text-center">
          <DialogTitle className="font-display text-h3 leading-tight text-text-primary text-balance">
            {title ?? `Set ${targetLabel} to default?`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mx-0 mb-0 flex-col-reverse justify-center rounded-none border-0 bg-transparent p-0 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="outline"
            className="cms-dialog-cancel"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            tone="brand"
            onClick={() => {
              onReset();
              setOpen(false);
            }}
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
