"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navForConsole, isNavItemActive, type ConsoleViewer } from "@/components/console/console-nav";
import { ConsoleAccountMenu } from "@/components/console/console-account-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Wordmark } from "@/components/shared/wordmark";
import { Button } from "@/components/shared/button";
import { NavPending } from "@/components/console/nav-pending";
import { cn } from "@/lib/utils";

export function ReceptionHeader({ fullName, email, viewer }: { fullName: string; email: string; viewer: ConsoleViewer }) {
  const pathname = usePathname();
  return <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-surface-raised/95 backdrop-blur-md">
    <div className="mx-auto grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4 lg:px-6">
      <Link href="/reception" aria-label="WellPlace Reception home" className="flex min-h-tap shrink-0 items-center rounded-(--radius-control) focus-visible:ring-2 focus-visible:ring-focus-ring"><Wordmark height={20} /></Link>
      <nav aria-label="Reception navigation" className="order-3 col-span-3 grid min-w-0 grid-cols-3 gap-1 md:order-none md:col-span-1 md:mx-auto md:flex md:w-full md:max-w-2xl md:justify-center">
        {navForConsole("reception", viewer).map(({href,label,Icon}) => <Button hoverEffect="sweep" key={href} asChild variant="ghost" className={cn("h-auto! min-h-tap min-w-0 flex-1 flex-col gap-1 px-2 py-2 text-micro whitespace-normal lg:flex-none lg:flex-row sm:text-fine",isNavItemActive(pathname,href) && "reception-nav-active")}><Link href={href} aria-current={isNavItemActive(pathname,href) ? "page" : undefined}><NavPending><Icon aria-hidden="true" className="size-4" /></NavPending><span>{label}</span></Link></Button>)}
      </nav>
      <div className="col-start-3 flex items-center gap-2"><ThemeToggle size="navigation" /><ConsoleAccountMenu fullName={fullName} email={email} /></div>
    </div>
  </header>;
}
