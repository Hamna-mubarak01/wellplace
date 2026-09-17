
export const COOKIE_CHOICE_VERSION = 1;

export const COOKIE_STORAGE_KEY = "wellplace-cookie-choice";

export const COOKIE_CATEGORIES = [
  "necessary",
  "preferences",
  "analytics",
  "marketing",
] as const;

export type CookieCategory = (typeof COOKIE_CATEGORIES)[number];

export const OPTIONAL_COOKIE_CATEGORIES = [
  "preferences",
  "analytics",
  "marketing",
] as const;

export type OptionalCookieCategory = (typeof OPTIONAL_COOKIE_CATEGORIES)[number];

export type CookieChoice = Record<OptionalCookieCategory, boolean>;

export const DEFAULT_COOKIE_CHOICE: CookieChoice = {
  preferences: true,
  analytics: true,
  marketing: true,
};

export interface CookieCategoryCopy {
  readonly id: CookieCategory;
  readonly name: string;
  readonly description: string;
  readonly locked: boolean;
}

export const COOKIE_CATEGORY_COPY: readonly CookieCategoryCopy[] = [
  {
    id: "necessary",
    name: "Necessary",
    description:
      "Required to operate and secure the website. These cannot be switched off.",
    locked: true,
  },
  {
    id: "preferences",
    name: "Preferences",
    description:
      "Remember choices you make, such as Light or Dark appearance.",
    locked: false,
  },
  {
    id: "analytics",
    name: "Analytics",
    description:
      "Help us understand how visitors use the website so we can improve it.",
    locked: false,
  },
  {
    id: "marketing",
    name: "Marketing",
    description:
      "Measure our advertising and show you WellPlace adverts that are relevant.",
    locked: false,
  },
] as const;

export const CONSENT_SIGNALS: Readonly<
  Record<OptionalCookieCategory, readonly string[]>
> = {
  preferences: ["functionality_storage", "personalization_storage"],
  analytics: ["analytics_storage"],
  marketing: ["ad_storage", "ad_user_data", "ad_personalization"],
} as const;

export const ALWAYS_GRANTED_SIGNALS = ["security_storage"] as const;

export function isCookieChoice(value: unknown): value is CookieChoice {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return OPTIONAL_COOKIE_CATEGORIES.every(
    (category) => typeof candidate[category] === "boolean",
  );
}

export function consentStateFor(
  choice: CookieChoice,
): Record<string, "granted" | "denied"> {
  const state: Record<string, "granted" | "denied"> = {};
  for (const signal of ALWAYS_GRANTED_SIGNALS) state[signal] = "granted";
  for (const category of OPTIONAL_COOKIE_CATEGORIES) {
    for (const signal of CONSENT_SIGNALS[category]) {
      state[signal] = choice[category] ? "granted" : "denied";
    }
  }
  return state;
}

export interface StoredCookieChoice {
  readonly v: number;
  readonly c: CookieChoice;
  readonly at: string;
}

export function serialiseCookieChoice(choice: CookieChoice): string {
  const stored: StoredCookieChoice = {
    v: COOKIE_CHOICE_VERSION,
    c: choice,
    at: new Date().toISOString(),
  };
  return JSON.stringify(stored);
}

export function parseCookieChoice(raw: string | null): CookieChoice | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const stored = parsed as Partial<StoredCookieChoice>;
    if (stored.v !== COOKIE_CHOICE_VERSION) return null;
    return isCookieChoice(stored.c) ? stored.c : null;
  } catch {
    return null;
  }
}

export function consentBootstrapScript(): string {
  const granted = JSON.stringify(
    consentStateFor({ preferences: true, analytics: true, marketing: true }),
  );
  const signals = JSON.stringify(CONSENT_SIGNALS);
  return `(function(){var s=${granted},m=${signals},c=null;try{var r=localStorage.getItem(${JSON.stringify(
    COOKIE_STORAGE_KEY,
  )});if(r){var p=JSON.parse(r);if(p&&p.v===${COOKIE_CHOICE_VERSION}&&p.c)c=p.c}}catch(e){}if(c){for(var k in m){if(c[k]===false){for(var i=0;i<m[k].length;i++)s[m[k][i]]="denied"}}}window.dataLayer=window.dataLayer||[];if(!window.gtag){window.gtag=function(){window.dataLayer.push(arguments)}}window.gtag("consent","default",s);})();`;
}
