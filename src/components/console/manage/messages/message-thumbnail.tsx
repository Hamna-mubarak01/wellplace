import { MailIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface MessageThumbnailProps {
  className?: string;
}

export function MessageThumbnail({ className }: MessageThumbnailProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-40 w-full flex-col items-center justify-center gap-3 rounded-(--radius-control) border border-border bg-brand-wash",
        className,
      )}
    >
      <span className="flex size-20 items-center justify-center rounded-full border border-border bg-surface-raised">
        <MailIcon className="size-10 text-brand" strokeWidth={1.5} />
      </span>
      <span className="text-console-label font-medium tracking-label text-text-secondary uppercase">
        Email template
      </span>
    </div>
  );
}
