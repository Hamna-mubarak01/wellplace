import type { ComponentProps } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/shared/button";
import { DialogClose, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function SuiteDialogContent({
  children,
  className,
  closeDisabled = false,
  ...props
}: ComponentProps<typeof DialogContent> & { closeDisabled?: boolean }) {
  return (
    <DialogContent
      {...props}
      showCloseButton={false}
      className={cn("suite-dialog density-console flex max-h-dialog-max-h min-h-0 flex-col gap-0 overflow-hidden border border-border bg-surface-base p-0 sm:max-w-lg", className)}
    >
      {children}
      <div className="absolute right-2 top-2">
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon" disabled={closeDisabled} aria-label="Close">
            <XIcon aria-hidden="true" className="size-4" />
          </Button>
        </DialogClose>
      </div>
    </DialogContent>
  );
}
