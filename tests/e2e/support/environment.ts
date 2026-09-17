import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const BASE_URL =
  process.env.WELLPLACE_E2E_BASE_URL ?? "http://localhost:3000";

export const ARTIFACT_DIR = join(process.cwd(), "tests", "e2e", ".artifacts");
export const STATUS_FILE = join(ARTIFACT_DIR, "environment.json");
export const STORAGE_STATE_FILE = join(ARTIFACT_DIR, "staff-session.json");

export interface EnvironmentStatus {
  readonly serverReachable: boolean;
  readonly signedIn: boolean;
  readonly role: string | null;
  readonly serverMessage: string;
  readonly sessionMessage: string;
}

const UNPROBED: EnvironmentStatus = {
  serverReachable: false,
  signedIn: false,
  role: null,
  serverMessage:
    `No environment probe was written. Run the suite through "npm run test:e2e" so ` +
    `tests/e2e/global-setup.ts runs first.`,
  sessionMessage: "No environment probe was written.",
};

export function environmentStatus(): EnvironmentStatus {
  if (!existsSync(STATUS_FILE)) return UNPROBED;
  return JSON.parse(readFileSync(STATUS_FILE, "utf8")) as EnvironmentStatus;
}

export interface Breakpoint {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

export const BREAKPOINTS: readonly Breakpoint[] = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
];

export const RECEPTION_TABLET: Breakpoint = {
  name: "1024",
  width: 1024,
  height: 768,
};

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_CHOICES: readonly ThemeChoice[] = [
  "light",
  "dark",
  "system",
];

export const THEME_STORAGE_KEY = "wellplace-theme";

export const RECEPTION_ROUTES = ["/reception", "/reception/board"] as const;

export const RECEPTION_SURFACES = [
  "/reception",
  "/reception/board",
  "/reception/bookings",
  "/reception/cleaning",
  "/reception/tasks",
  "/reception/alerts",
] as const;

export const MANAGE_SURFACES = [
  "/manage/settings",
  "/manage/suites",
  "/manage/messages",
  "/manage/staff",
] as const;

export const CONSOLE_SURFACES = [
  ...RECEPTION_SURFACES,
  ...MANAGE_SURFACES,
] as const;

export const FORBIDDEN_IN_A_GUEST_RESPONSE: ReadonlyArray<{
  readonly name: string;
  readonly pattern: RegExp;
}> = [
  { name: "a suite id", pattern: /suite[_-]?id/i },
  { name: "a suite number", pattern: /suite[_-]?number/i },
  { name: "a suite column of any kind", pattern: /"suites?"\s*:/i },
  { name: "a remaining-capacity count", pattern: /"?remaining"?\s*[:=]\s*\d/i },
  { name: "a total capacity", pattern: /(total|max)[_-]?(capacity|suites)/i },
  { name: "an occupancy row", pattern: /suite[_-]?occupancy/i },
];
