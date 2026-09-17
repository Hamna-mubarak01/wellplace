import {
  CONSOLE_HOME,
  canEnterPath,
  homeForRole,
  type ConsoleRole,
} from "@/lib/auth/console";

export const RETURN_TO_COOKIE = "wp-return-to";
export const NOTICE_COOKIE = "wp-auth-notice";

export const DEFAULT_AFTER_SIGN_IN = CONSOLE_HOME.reception;

export const RETURN_TO_MAX_AGE = 600;
export const NOTICE_MAX_AGE = 60;

export type AuthNotice = "link_expired" | "link_invalid" | "account_switched";

export function safePath(value: string | undefined | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function safeReturnPath(
  value: string | undefined | null,
  role: ConsoleRole | null,
): string {
  if (role === null) return safePath(value, DEFAULT_AFTER_SIGN_IN);

  const home = homeForRole(role);
  const path = safePath(value, home);

  return canEnterPath(role, path) ? path : home;
}

export function isAuthNotice(value: string | undefined): value is AuthNotice {
  return (
    value === "link_expired" ||
    value === "link_invalid" ||
    value === "account_switched"
  );
}
