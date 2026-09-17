"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronRightIcon, LogOutIcon, XIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";

import { signOut } from "@/app/(console)/sign-in/actions";
import {
  activeNavHref,
  consoleForPathname,
  consoleLabel,
  navEntriesForConsole,
  navForConsole,
  navGroupContaining,
  type ConsoleNavGroupId,
  type ConsoleNavItem,
  type ConsoleViewer,
} from "@/components/console/console-nav";
import { useNavGroupMemory } from "@/components/console/use-nav-group-memory";
import { CONSOLE_HOME, type ConsoleId } from "@/lib/auth/console";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import { NavPending } from "@/components/console/nav-pending";
import { Wordmark } from "@/components/shared/wordmark";
import { Button } from "@/components/shared/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export interface ConsoleSidebarProps {
  viewer: ConsoleViewer;
  consoleId: ConsoleId;
  badges?: Readonly<Record<string, number>>;
}

const ITEM_BUTTON =
  "relative min-h-tap text-console-body text-text-secondary hover:bg-surface-hover hover:text-text-primary group-data-[collapsible=icon]:size-tap! group-data-[collapsible=icon]:p-3.5! data-active:bg-brand data-active:font-medium data-active:text-on-brand data-active:hover:bg-brand data-active:hover:text-on-brand";

const GROUP_BUTTON =
  "min-h-tap text-console-body font-medium text-text-primary hover:bg-surface-hover hover:text-text-primary data-open:hover:bg-surface-hover data-open:hover:text-text-primary [&>svg:first-child]:text-text-muted";

const SUB_BUTTON =
  "h-auto min-h-tap py-2 text-console-body text-text-secondary hover:bg-surface-hover hover:text-text-primary active:bg-surface-active data-active:bg-brand data-active:font-medium data-active:text-on-brand data-active:hover:bg-brand data-active:hover:text-on-brand [&>svg]:text-text-muted hover:[&>svg]:text-text-primary data-active:[&>svg]:text-on-brand";

const SUB_ITEM_TREE =
  "relative py-0.5 pl-4 before:pointer-events-none before:absolute before:top-0 before:left-0 before:h-full before:w-px before:bg-border-strong before:content-[''] last:before:h-1/2 after:pointer-events-none after:absolute after:top-1/2 after:left-0 after:h-px after:w-4 after:-translate-y-1/2 after:bg-border-strong after:content-['']";

const COUNT_BADGE =
  "h-5 min-w-5 shrink-0 justify-center rounded-full border-transparent bg-danger px-1.5 font-data text-micro tabular-nums text-on-brand";

function countLabel(count: number): string {
  return count > CONSOLE_LIST.navBadgeMax ? `${CONSOLE_LIST.navBadgeMax}+` : String(count);
}

function countFor(badges: Readonly<Record<string, number>> | undefined, href: string): number {
  const count = badges?.[href] ?? 0;
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function ConsoleSidebar({ viewer, consoleId, badges }: ConsoleSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, startSignOut] = useTransition();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const iconOnly = collapsed && !isMobile;

  const current = consoleForPathname(pathname, consoleId);
  const entries = navEntriesForConsole(current, viewer);
  const activeHref = activeNavHref(pathname, navForConsole(current, viewer));
  const activeGroupId = navGroupContaining(entries, activeHref);

  const { remembered, remember } = useNavGroupMemory();
  const [visit, setVisit] = useState<{ group: ConsoleNavGroupId | null; open: boolean }>({
    group: activeGroupId,
    open: true,
  });
  if (visit.group !== activeGroupId) {
    setVisit({ group: activeGroupId, open: true });
  }

  function isGroupOpen(groupId: ConsoleNavGroupId): boolean {
    if (groupId === activeGroupId) return visit.open;
    return remembered[groupId] ?? false;
  }

  function setGroupOpen(groupId: ConsoleNavGroupId, open: boolean) {
    if (groupId === activeGroupId) setVisit({ group: groupId, open });
    remember(groupId, open);
  }

  function closeMobile() {
    setOpenMobile(false);
  }

  function renderItemLink(item: ConsoleNavItem) {
    const active = item.href === activeHref;
    const count = countFor(badges, item.href);
    return (
      <Link href={item.href} aria-current={active ? "page" : undefined} onClick={closeMobile}>
        <item.Icon aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {count > 0 && <Badge className={COUNT_BADGE}>{countLabel(count)}</Badge>}
        <NavPending />
      </Link>
    );
  }

  return (
    <Sidebar collapsible="icon" className="border-border">
      <SidebarHeader className="h-console-header flex-row items-center border-b border-border px-2 py-0">
        <Link
          href={CONSOLE_HOME[current]}
          onClick={closeMobile}
          aria-label={`WellPlace ${consoleLabel(current).toLowerCase()}`}
          className="flex h-tap min-w-0 flex-1 items-center justify-center rounded-(--radius-control) px-2 transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
        >
          {collapsed ? (
            <Wordmark variant="icon" height={22} label="WellPlace console" />
          ) : (
            <Wordmark variant="wordmark" height={20} label="WellPlace console" />
          )}
        </Link>
        {isMobile && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            onClick={closeMobile}
          >
            <XIcon aria-hidden="true" className="size-4" />
          </Button>
        )}
      </SidebarHeader>

      <SidebarContent className="pt-2">
        {entries.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <nav aria-label={consoleLabel(current)}>
                <SidebarMenu className="gap-1">
                  {entries.map((entry) => {
                    if (entry.kind === "item") {
                      const { item } = entry;
                      const active = item.href === activeHref;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={active} tooltip={item.label} className={ITEM_BUTTON}>
                            <Link href={item.href} aria-current={active ? "page" : undefined} onClick={closeMobile}>
                              <item.Icon aria-hidden="true" />
                              <span className="min-w-0 flex-1 truncate">{item.label}</span>
                              <NavPending />
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }

                    const { group, items } = entry;
                    const containsActive = group.id === activeGroupId;
                    const groupCount = items.reduce((sum, item) => sum + countFor(badges, item.href), 0);

                    if (iconOnly) {
                      return (
                        <SidebarMenuItem key={group.id}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuButton isActive={containsActive} tooltip={group.label} className={ITEM_BUTTON}>
                                <group.Icon aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">{group.label}</span>
                              </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56">
                              <DropdownMenuLabel className="text-console-label tracking-label text-text-muted uppercase">
                                {group.label}
                              </DropdownMenuLabel>
                              {items.map((item) => {
                                const active = item.href === activeHref;
                                const count = countFor(badges, item.href);
                                return (
                                  <DropdownMenuItem
                                    key={item.href}
                                    asChild
                                    className={cn(
                                      "min-h-tap text-console-body",
                                      active && "bg-brand font-medium text-on-brand focus:bg-brand focus:text-on-brand",
                                    )}
                                  >
                                    <Link href={item.href} aria-current={active ? "page" : undefined}>
                                      <item.Icon aria-hidden="true" />
                                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                      {count > 0 && <Badge className={COUNT_BADGE}>{countLabel(count)}</Badge>}
                                    </Link>
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </SidebarMenuItem>
                      );
                    }

                    const open = isGroupOpen(group.id);
                    return (
                      <Collapsible
                        key={group.id}
                        asChild
                        open={open}
                        onOpenChange={(next) => setGroupOpen(group.id, next)}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton className={GROUP_BUTTON}>
                              <group.Icon aria-hidden="true" />
                              <span className="min-w-0 flex-1 truncate">{group.label}</span>
                              {!open && groupCount > 0 && (
                                <Badge className={COUNT_BADGE}>{countLabel(groupCount)}</Badge>
                              )}
                              <ChevronRightIcon
                                aria-hidden="true"
                                className={cn(
                                  "text-text-muted transition-transform duration-150 group-data-[state=open]/collapsible:rotate-90 motion-reduce:transition-none",
                                  containsActive && "text-text-secondary",
                                )}
                              />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub className="mt-1 gap-0 border-l-0 px-0">
                              {items.map((item) => (
                                <SidebarMenuSubItem key={item.href} className={SUB_ITEM_TREE}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={item.href === activeHref}
                                    className={SUB_BUTTON}
                                  >
                                    {renderItemLink(item)}
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  })}
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              disabled={signingOut}
              onClick={() =>
                startSignOut(async () => {
                  const result = await signOut();
                  if (!result.ok) {
                    toast.error("Could not sign out", { description: result.message });
                    return;
                  }
                  router.replace("/sign-in");
                  router.refresh();
                })
              }
              className="min-h-tap text-console-body text-text-secondary hover:bg-surface-hover hover:text-text-primary group-data-[collapsible=icon]:size-tap! group-data-[collapsible=icon]:p-3.5!"
            >
              <LogOutIcon aria-hidden="true" />
              <span className="truncate">
                {signingOut ? "Signing out…" : "Sign out"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
