import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface LedgerLinkProps {
  href: string;
  children: ReactNode;
  label?: string;
  data?: boolean;
  className?: string;
}

export function LedgerLink({ href, children, label, data = false, className }: LedgerLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "inline-flex min-h-tap max-w-full min-w-0 flex-col justify-center rounded-(--radius-inner) text-text-primary underline-offset-4 outline-none hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring",
        data && "font-data tabular-nums",
        className,
      )}
    >
      {children}
    </Link>
  );
}
