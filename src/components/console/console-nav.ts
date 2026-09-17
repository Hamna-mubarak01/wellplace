import {
  BanIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  ContactRoundIcon,
  CreditCardIcon,
  DoorOpenIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MessageSquareTextIcon,
  ReceiptTextIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  TagIcon,
  TagsIcon,
  TicketPercentIcon,
  Undo2Icon,
  UserCogIcon,
  UserRoundPlusIcon,
  UsersRoundIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import {
  CONSOLE_ROOT,
  CONSOLE_LABEL,
  canEnterConsole,
  consoleForPath,
  type ConsoleId,
} from "@/lib/auth/console";
import { heldByRole } from "@/lib/config/permissions";
import type { StaffRole } from "@/lib/auth/session";
import type { Database } from "@/types/database.generated";

export type NamedPermission = Database["public"]["Enums"]["named_permission"];

export type ConsoleNavSection = ConsoleId;

export interface ConsoleViewer {
  readonly role: StaffRole;
  readonly permissions: readonly NamedPermission[];
}

export type ConsoleNavGroupId =
  | "suites-bookings"
  | "customers"
  | "finance"
  | "pricing"
  | "administration";

export interface ConsoleNavGroup {
  readonly id: ConsoleNavGroupId;
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly section: ConsoleNavSection;
}

export interface ConsoleNavItem {
  readonly href: string;
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly section: ConsoleNavSection;
  readonly group: ConsoleNavGroupId | null;
  readonly requiresRole: StaffRole | null;
  readonly requiresPermission: NamedPermission | null;
}

export type ConsoleNavEntry =
  | { readonly kind: "item"; readonly item: ConsoleNavItem }
  | {
      readonly kind: "group";
      readonly group: ConsoleNavGroup;
      readonly items: ReadonlyArray<ConsoleNavItem>;
    };

export const CONSOLE_NAV_GROUPS: ReadonlyArray<ConsoleNavGroup> = [
  { id: "suites-bookings", label: "Suites & bookings", Icon: CalendarDaysIcon, section: "manage" },
  { id: "customers", label: "Customers", Icon: UsersRoundIcon, section: "manage" },
  { id: "finance", label: "Finance", Icon: WalletIcon, section: "manage" },
  { id: "pricing", label: "Pricing & discounts", Icon: TagsIcon, section: "manage" },
  { id: "administration", label: "Administration", Icon: Settings2Icon, section: "manage" },
];

function receptionItem(href: string, label: string, Icon: LucideIcon): ConsoleNavItem {
  return {
    href,
    label,
    Icon,
    section: "reception",
    group: null,
    requiresRole: null,
    requiresPermission: null,
  };
}

function managementItem(
  group: ConsoleNavGroupId,
  href: string,
  label: string,
  Icon: LucideIcon,
): ConsoleNavItem {
  return {
    href,
    label,
    Icon,
    section: "manage",
    group,
    requiresRole: "management",
    requiresPermission: null,
  };
}

export const CONSOLE_NAV: ReadonlyArray<ConsoleNavItem> = [
  receptionItem("/reception", "Front desk", LayoutDashboardIcon),
  receptionItem("/reception/bookings", "Bookings", CalendarCheckIcon),
  receptionItem("/reception/tasks", "Tasks and handover", ListChecksIcon),

  managementItem("suites-bookings", "/manage/suites", "Suites", DoorOpenIcon),
  managementItem("suites-bookings", "/manage/bookings", "Bookings", CalendarCheckIcon),

  managementItem("customers", "/manage/customers", "Customers", ContactRoundIcon),
  managementItem("customers", "/manage/customers/leads", "Leads", UserRoundPlusIcon),
  managementItem("customers", "/manage/customers/blocked", "Blocked", BanIcon),
  managementItem("customers", "/manage/waitlist", "Waitlist", ClipboardListIcon),

  managementItem("finance", "/manage/finance/payments", "Payments", CreditCardIcon),
  managementItem("finance", "/manage/finance/refunds", "Refunds", Undo2Icon),
  managementItem("finance", "/manage/finance/invoices", "Invoices", ReceiptTextIcon),

  managementItem("pricing", "/manage/pricing", "Prices and add-ons", TagIcon),
  managementItem("pricing", "/manage/coupons", "Coupons", TicketPercentIcon),

  managementItem("administration", "/manage/staff", "Staff", UserCogIcon),
  managementItem("administration", "/manage/tasks", "Tasks", ListChecksIcon),
  managementItem("administration", "/manage/messages", "Message templates", MessageSquareTextIcon),
  managementItem("administration", "/manage/cms", "Website content", FileTextIcon),
  managementItem("administration", "/manage/settings", "Settings", SlidersHorizontalIcon),
];

export function canSeeNavItem(item: ConsoleNavItem, viewer: ConsoleViewer): boolean {
  if (item.requiresRole !== null && viewer.role !== item.requiresRole) return false;
  if (item.requiresPermission !== null && !heldByRole(item.requiresPermission, viewer.role)) {
    return false;
  }
  return true;
}

export function navForConsole(
  consoleId: ConsoleId,
  viewer: ConsoleViewer,
): ReadonlyArray<ConsoleNavItem> {
  return CONSOLE_NAV.filter(
    (item) => canEnterConsole(viewer.role, consoleId) && item.section === consoleId && canSeeNavItem(item, viewer),
  );
}

export function navEntriesForConsole(
  consoleId: ConsoleId,
  viewer: ConsoleViewer,
): ReadonlyArray<ConsoleNavEntry> {
  const visible = navForConsole(consoleId, viewer);
  const entries: ConsoleNavEntry[] = [];
  const placed = new Set<ConsoleNavGroupId>();

  for (const item of visible) {
    if (item.group === null) {
      entries.push({ kind: "item", item });
      continue;
    }
    if (placed.has(item.group)) continue;

    const group = CONSOLE_NAV_GROUPS.find((candidate) => candidate.id === item.group);
    if (group === undefined) {
      entries.push({ kind: "item", item });
      continue;
    }

    placed.add(group.id);
    entries.push({
      kind: "group",
      group,
      items: visible.filter((candidate) => candidate.group === group.id),
    });
  }

  return entries;
}

export function consoleLabel(consoleId: ConsoleId): string {
  return CONSOLE_LABEL[consoleId];
}

export function consoleForPathname(
  pathname: string,
  fallback: ConsoleId,
): ConsoleId {
  return consoleForPath(pathname) ?? fallback;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  const isConsoleRoot = Object.values(CONSOLE_ROOT).includes(href);
  return pathname === href || (!isConsoleRoot && pathname.startsWith(`${href}/`));
}

export function activeNavHref(
  pathname: string,
  items: ReadonlyArray<ConsoleNavItem>,
): string | null {
  let best: string | null = null;
  for (const item of items) {
    if (!isNavItemActive(pathname, item.href)) continue;
    if (best === null || item.href.length > best.length) best = item.href;
  }
  return best;
}

export function navGroupContaining(
  entries: ReadonlyArray<ConsoleNavEntry>,
  href: string | null,
): ConsoleNavGroupId | null {
  if (href === null) return null;
  for (const entry of entries) {
    if (entry.kind === "group" && entry.items.some((item) => item.href === href)) {
      return entry.group.id;
    }
  }
  return null;
}

export function initialsFor(fullName: string): string {
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "?";
}
