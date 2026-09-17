"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const OWN_INTERACTION =
  "a, button, input, select, textarea, label, summary, [role='button'], [role='menuitem'], [role='checkbox'], [role='switch'], [data-row-actions]";

export interface ConsoleLinkedRowProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export function ConsoleLinkedRow({ href, children, className }: ConsoleLinkedRowProps) {
  const router = useRouter();

  function open(event: MouseEvent<HTMLTableRowElement>) {
    if (event.defaultPrevented || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
    if (target.closest(OWN_INTERACTION)) return;
    if (window.getSelection()?.toString()) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  }

  return (
    <TableRow
      data-linked=""
      onClick={open}
      className={cn(
        "cursor-pointer hover:bg-surface-hover focus-within:bg-surface-hover",
        className,
      )}
    >
      {children}
    </TableRow>
  );
}
