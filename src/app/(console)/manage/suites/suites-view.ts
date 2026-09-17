import type { ManagedSuite } from "@/lib/db/queries/suite-inventory";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import { SUITE_NUMBER_MIN } from "@/lib/config/suite-management";
import { NEVER_AUTO_ALLOCATED } from "@/lib/config/suite-status";
import { DUBAI_TIME_ZONE, formatDubaiTime, todayInDubai } from "@/lib/domain/time";

export type SuitesSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export type SuiteStatus = ManagedSuite["status"];
export type LiveState = SuiteStatus | "retired";

export const SUITES_PATH = "/manage/suites";

export const SUITE_PARAM = "suite";
export const SUITE_TAB_PARAM = "tab";
export const BOOKED_MONTH_PARAM = "booked";
export const RATES_MONTH_PARAM = "rates";

export const DRAWER_PARAMS: readonly string[] = [
  SUITE_PARAM,
  SUITE_TAB_PARAM,
  BOOKED_MONTH_PARAM,
  RATES_MONTH_PARAM,
];

export const LIVE_STATE_LABEL: Readonly<Record<LiveState, string>> = {
  available: "Available",
  checkout_hold: "Checkout hold",
  booked: "Booked",
  checked_in: "Checked in",
  cleaning: "Cleaning",
  blocked: "Blocked",
  maintenance: "Maintenance",
  not_ready: "Not ready",
  out_of_service: "Out of service",
  retired: "Retired",
};

export const SUITE_GROUPS = ["available", "in_use", "held"] as const;
export type SuiteGroup = (typeof SUITE_GROUPS)[number];

export const SUITE_GROUP_LABEL: Readonly<Record<SuiteGroup, string>> = {
  available: "Available now",
  in_use: "In use now",
  held: "Held by staff",
};

export const RETIRED_VIEWS = ["hide", "show", "only"] as const;
export type RetiredView = (typeof RETIRED_VIEWS)[number];

export const RETIRED_VIEW_LABEL: Readonly<Record<RetiredView, string>> = {
  hide: "Hide",
  show: "Show",
  only: "Only",
};

export const STAFF_STATUSES: readonly SuiteStatus[] = [
  "available",
  "not_ready",
  "blocked",
  "maintenance",
  "out_of_service",
];

export const STAFF_STATUS_HINT: Readonly<Partial<Record<SuiteStatus, string>>> = {
  available: "Offered for bookings automatically.",
  not_ready: "Needs more time before the next guest.",
  blocked: "Closed to bookings until you release it.",
  maintenance: "Closed while repairs or servicing happen.",
  out_of_service: "Closed until further notice.",
};

const IN_USE_STATES: readonly LiveState[] = ["checkout_hold", "booked", "checked_in", "cleaning"];
const MS_PER_DAY = 86_400_000;

export function holdsSuite(status: SuiteStatus): boolean {
  return NEVER_AUTO_ALLOCATED.includes(status);
}

export function initialStatusChoice(stored: SuiteStatus): SuiteStatus | null {
  return STAFF_STATUSES.includes(stored) ? stored : null;
}

export function canSaveStatus(choice: SuiteStatus | null, stored: SuiteStatus): boolean {
  return choice !== null && choice !== stored;
}

export interface SuitesQuery {
  readonly search: string;
  readonly group: SuiteGroup | null;
  readonly retired: RetiredView;
}

export interface SuitesSummary {
  readonly active: number;
  readonly available: number;
  readonly inUse: number;
  readonly held: number;
  readonly retired: number;
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return allowed.find((candidate) => candidate === value) ?? null;
}

export function isRetired(suite: Pick<ManagedSuite, "isActive" | "retiredAt">): boolean {
  return suite.retiredAt !== null || !suite.isActive;
}

function occupancyState(boardState: string | null): SuiteStatus | null {
  switch (boardState) {
    case "hold":
      return "checkout_hold";
    case "booked":
      return "booked";
    case "checked_in":
      return "checked_in";
    case "cleaning":
      return "cleaning";
    case "block":
      return "blocked";
    case "maintenance":
      return "maintenance";
    default:
      return null;
  }
}

export function liveState(
  suite: Pick<ManagedSuite, "isActive" | "retiredAt" | "currentState" | "status">,
): LiveState {
  if (isRetired(suite)) return "retired";
  return occupancyState(suite.currentState) ?? suite.status;
}

export function staffState(suite: Pick<ManagedSuite, "isActive" | "retiredAt" | "status">): LiveState {
  return isRetired(suite) ? "retired" : suite.status;
}

export function suiteStatusLine(
  suite: Pick<ManagedSuite, "isActive" | "retiredAt" | "currentState" | "status" | "nextBookingAt">,
  now: Date,
): string {
  const state = liveState(suite);
  const next = suite.nextBookingAt ? formatDubaiMoment(suite.nextBookingAt, now) : null;

  if (state === "retired") return "Not taking bookings";
  if (state === "available") return next === null ? "Free, nothing booked" : `Free until ${next}`;
  return next === null ? "Nothing booked next" : `Next booking ${next}`;
}

export function nowLabel(state: LiveState): string {
  if (state === "available") return "Free";
  if (state === "retired") return "Not taking bookings";
  return LIVE_STATE_LABEL[state];
}

export function suiteGroup(state: LiveState): SuiteGroup | null {
  if (state === "available") return "available";
  if (IN_USE_STATES.includes(state)) return "in_use";
  if ((NEVER_AUTO_ALLOCATED as readonly LiveState[]).includes(state)) return "held";
  return null;
}

export function parseSuitesQuery(params: SuitesSearchParams): SuitesQuery {
  return {
    search: (single(params.q) ?? "").trim().slice(0, CONSOLE_LIST.searchMaxLength),
    group: oneOf(single(params.status), SUITE_GROUPS),
    retired: oneOf(single(params.retired), RETIRED_VIEWS) ?? "hide",
  };
}

export function isFiltered(query: SuitesQuery): boolean {
  return query.search !== "" || query.group !== null || query.retired !== "hide";
}

export function matchesSearch(
  suite: Pick<ManagedSuite, "suiteNumber" | "displayName">,
  search: string,
): boolean {
  const needle = search.trim().toLowerCase();
  if (needle === "") return true;
  const haystack = `suite ${suite.suiteNumber} ${suite.displayName ?? ""}`.toLowerCase();
  return haystack.includes(needle);
}

export function filterSuites(suites: readonly ManagedSuite[], query: SuitesQuery): ManagedSuite[] {
  return suites.filter((suite) => {
    const state = liveState(suite);
    if (state === "retired" && query.retired === "hide") return false;
    if (state !== "retired" && query.retired === "only") return false;
    if (query.group !== null && suiteGroup(state) !== query.group) return false;
    return matchesSearch(suite, query.search);
  });
}

export function summariseSuites(suites: readonly ManagedSuite[]): SuitesSummary {
  const groups = suites.map((suite) => suiteGroup(liveState(suite)));
  return {
    active: suites.filter((suite) => !isRetired(suite)).length,
    available: groups.filter((group) => group === "available").length,
    inUse: groups.filter((group) => group === "in_use").length,
    held: groups.filter((group) => group === "held").length,
    retired: suites.filter(isRetired).length,
  };
}

export function suiteName(suite: Pick<ManagedSuite, "suiteNumber" | "displayName">): string | null {
  const name = suite.displayName?.trim() ?? "";
  if (name === "" || name.toLowerCase() === `suite ${suite.suiteNumber}`) return null;
  return name;
}

export function nextSuiteNumber(suites: readonly Pick<ManagedSuite, "suiteNumber">[]): number {
  return Math.max(SUITE_NUMBER_MIN - 1, ...suites.map((suite) => suite.suiteNumber)) + 1;
}

const DUBAI_WEEKDAY_DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const DUBAI_WEEKDAY_DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDubaiDay(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "";
  return DUBAI_WEEKDAY_DAY_MONTH_YEAR.format(date).replace(",", "");
}

export function formatDubaiMoment(instant: string, now: Date): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "";

  const day = todayInDubai(date);
  const time = formatDubaiTime(date);
  if (day === todayInDubai(now)) return `Today, ${time}`;
  if (day === todayInDubai(new Date(now.getTime() + MS_PER_DAY))) return `Tomorrow, ${time}`;

  const sameYear = day.slice(0, 4) === todayInDubai(now).slice(0, 4);
  const label = (sameYear ? DUBAI_WEEKDAY_DAY_MONTH : DUBAI_WEEKDAY_DAY_MONTH_YEAR).format(date).replace(",", "");
  return `${label}, ${time}`;
}

export function suiteDrawerHref(current: string, suiteId: string | null): string {
  const next = new URLSearchParams(current);
  for (const key of DRAWER_PARAMS) next.delete(key);
  if (suiteId !== null) next.set(SUITE_PARAM, suiteId);
  const query = next.toString();
  return query ? `${SUITES_PATH}?${query}` : SUITES_PATH;
}

export function suitePath(suiteId: string): string {
  return suiteDrawerHref("", suiteId);
}

export function listParams(params: SuitesSearchParams): SuitesSearchParams {
  return Object.fromEntries(Object.entries(params).filter(([key]) => !DRAWER_PARAMS.includes(key)));
}

export function suitesHref(
  params: SuitesSearchParams,
  patch: Readonly<Record<string, string | null>>,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const current = single(value);
    if (current !== undefined && current !== "") next.set(key, current);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `${SUITES_PATH}?${query}` : SUITES_PATH;
}
