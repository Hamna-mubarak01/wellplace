"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function ManagementFrame({
  children,
  shell,
}: {
  children: ReactNode;
  shell: ReactNode;
}) {
  const pathname = usePathname();
  return /^\/manage\/messages\/[^/]+\/?$/.test(pathname) ? children : shell;
}
