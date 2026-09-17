"use client";

import { useLinkStatus } from "next/link";
import { LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavPending({ children }: { children?: React.ReactNode }) {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      data-pending={pending || undefined}
      data-console-navigating={pending || undefined}
      className={cn("inline-flex size-4 shrink-0 items-center justify-center", !children && "ml-auto opacity-0 transition-opacity data-[pending]:opacity-100")}
    >
      {pending || !children ? <LoaderIcon className="size-4 text-brand motion-safe:animate-spin" /> : children}
    </span>
  );
}
