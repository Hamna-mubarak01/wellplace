export type ConsoleId = "reception" | "manage";

export type ConsoleRole = "reception" | "management";

export const CONSOLE_IDS: readonly ConsoleId[] = ["manage", "reception"];

export const CONSOLE_ROOT: Readonly<Record<ConsoleId, string>> = {
  reception: "/reception",
  manage: "/manage",
};

export const CONSOLE_HOME: Readonly<Record<ConsoleId, string>> = {
  reception: "/reception",
  manage: "/manage/suites",
};

export const CONSOLE_LABEL: Readonly<Record<ConsoleId, string>> = {
  reception: "Reception console",
  manage: "Management console",
};

export function isConsoleId(value: string | undefined | null): value is ConsoleId {
  return value === "reception" || value === "manage";
}

export function consoleForPath(pathname: string): ConsoleId | null {
  for (const id of CONSOLE_IDS) {
    const root = CONSOLE_ROOT[id];
    if (pathname === root || pathname.startsWith(`${root}/`)) return id;
  }
  return null;
}

export function consolesForRole(role: ConsoleRole): readonly ConsoleId[] {
  return role === "management" ? ["manage"] : ["reception"];
}

export function canEnterConsole(role: ConsoleRole, id: ConsoleId): boolean {
  return consolesForRole(role).includes(id);
}

export function canEnterPath(role: ConsoleRole, pathname: string): boolean {
  const id = consoleForPath(pathname);
  if (id === null) return true;
  return canEnterConsole(role, id);
}

export function homeForRole(role: ConsoleRole): string {
  return CONSOLE_HOME[role === "management" ? "manage" : "reception"];
}
