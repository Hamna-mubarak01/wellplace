"use client";

import { usePathname } from "next/navigation";

import {
  consoleForPathname,
  consoleLabel,
} from "@/components/console/console-nav";
import type { ConsoleId } from "@/lib/auth/console";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ConsoleAccountMenu } from "@/components/console/console-account-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";

export interface ConsoleHeaderProps {
  fullName: string;
  email: string;
  consoleId: ConsoleId;
}

export function ConsoleHeader({ fullName, email, consoleId }: ConsoleHeaderProps) {
  const pathname = usePathname();

  const firstName = fullName.trim().split(/\s+/)[0] || fullName;
  const current = consoleForPathname(pathname, consoleId);

  return (
    <header className="sticky top-0 z-20 flex h-console-header shrink-0 items-center gap-3 border-b border-border bg-surface-base/85 px-3 backdrop-blur-md sm:px-4 lg:px-6">
      <SidebarTrigger className="-ml-1 size-tap shrink-0" />

      <p className="hidden min-w-0 truncate text-console-body text-text-secondary sm:block">
        Welcome,{" "}
        <span className="font-medium text-text-primary">{firstName}</span>
      </p>

      <p className="min-w-0 truncate text-console-label tracking-label text-text-muted uppercase">
        {consoleLabel(current)}
      </p>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <ThemeToggle size="navigation" />

        <ConsoleAccountMenu fullName={fullName} email={email} />
      </div>
    </header>
  );
}
