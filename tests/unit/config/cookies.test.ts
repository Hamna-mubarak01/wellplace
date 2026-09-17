import { describe, expect, it } from "vitest";

import {
  ALWAYS_GRANTED_SIGNALS,
  COOKIE_CATEGORIES,
  COOKIE_CATEGORY_COPY,
  COOKIE_CHOICE_VERSION,
  COOKIE_STORAGE_KEY,
  CONSENT_SIGNALS,
  DEFAULT_COOKIE_CHOICE,
  OPTIONAL_COOKIE_CATEGORIES,
  type CookieChoice,
  consentBootstrapScript,
  consentStateFor,
  parseCookieChoice,
  serialiseCookieChoice,
} from "@/lib/config/cookies";


const ALL_ON: CookieChoice = { preferences: true, analytics: true, marketing: true };
const ALL_OFF: CookieChoice = { preferences: false, analytics: false, marketing: false };

const ALL_OPTIONAL_SIGNALS = OPTIONAL_COOKIE_CATEGORIES.flatMap(
  (category) => CONSENT_SIGNALS[category],
);

describe("consentStateFor — the categories a visitor can and cannot switch off", () => {
  it("everything on grants every signal", () => {
    const state = consentStateFor(ALL_ON);

    for (const signal of [...ALWAYS_GRANTED_SIGNALS, ...ALL_OPTIONAL_SIGNALS]) {
      expect(state[signal], signal).toBe("granted");
    }
  });

  it("everything off denies all three optional categories but still grants security_storage", () => {
    const state = consentStateFor(ALL_OFF);

    for (const signal of ALL_OPTIONAL_SIGNALS) {
      expect(state[signal], signal).toBe("denied");
    }
    for (const signal of ALWAYS_GRANTED_SIGNALS) {
      expect(state[signal], signal).toBe("granted");
    }
    expect(state.security_storage).toBe("granted");
  });

  it("each optional category controls exactly its own signals and no others", () => {
    for (const category of OPTIONAL_COOKIE_CATEGORIES) {
      const state = consentStateFor({ ...ALL_OFF, [category]: true });
      const mine = new Set<string>(CONSENT_SIGNALS[category]);

      expect(mine.size, `${category} governs no signals`).toBeGreaterThan(0);

      for (const signal of ALL_OPTIONAL_SIGNALS) {
        expect(state[signal], `${category} on → ${signal}`).toBe(
          mine.has(signal) ? "granted" : "denied",
        );
      }
      expect(state.security_storage, `${category} on → security_storage`).toBe("granted");
    }
  });

  it("no optional category claims security_storage, which no setting may revoke", () => {
    expect(ALL_OPTIONAL_SIGNALS).not.toContain("security_storage");
  });

  it("the default choice is opt-out, not opt-in — the client's v1.3 instruction", () => {
    expect(DEFAULT_COOKIE_CHOICE).toEqual(ALL_ON);
  });
});

describe("the stored choice round-trips", () => {
  it("parseCookieChoice reads back what serialiseCookieChoice wrote", () => {
    const choices: CookieChoice[] = [
      ALL_ON,
      ALL_OFF,
      { preferences: true, analytics: false, marketing: false },
      { preferences: false, analytics: true, marketing: false },
      { preferences: false, analytics: false, marketing: true },
    ];

    for (const choice of choices) {
      expect(parseCookieChoice(serialiseCookieChoice(choice))).toEqual(choice);
    }
  });

  it("what is written carries the version and a timestamp", () => {
    const stored: unknown = JSON.parse(serialiseCookieChoice(ALL_OFF));
    const record = stored as { v: number; at: string };

    expect(record.v).toBe(COOKIE_CHOICE_VERSION);
    expect(Number.isNaN(Date.parse(record.at))).toBe(false);
  });
});

describe("parseCookieChoice returns null and never throws for anything it cannot trust", () => {
  const untrusted: ReadonlyArray<readonly [string, string | null]> = [
    ["absent", null],
    ["empty string", ""],
    ["not json", "not json"],
    ["a json array", "[]"],
    ["an empty object", "{}"],
    ["a wrong version", JSON.stringify({ v: COOKIE_CHOICE_VERSION + 1, c: ALL_ON, at: "x" })],
    ["a missing version", JSON.stringify({ c: ALL_ON, at: "x" })],
    [
      "a missing category",
      JSON.stringify({ v: COOKIE_CHOICE_VERSION, c: { preferences: true, analytics: true }, at: "x" }),
    ],
    [
      "a non-boolean category",
      JSON.stringify({
        v: COOKIE_CHOICE_VERSION,
        c: { preferences: true, analytics: "yes", marketing: false },
        at: "x",
      }),
    ],
    ["a null choice", JSON.stringify({ v: COOKIE_CHOICE_VERSION, c: null, at: "x" })],
    ["json null", "null"],
    ["a bare number", "7"],
  ];

  for (const [label, raw] of untrusted) {
    it(`${label} is null, not a partial object and not a throw`, () => {
      let result: CookieChoice | null | undefined;
      expect(() => {
        result = parseCookieChoice(raw);
      }).not.toThrow();
      expect(result).toBeNull();
    });
  }
});

describe("consentBootstrapScript — injected raw into <head>, so it must parse", () => {
  const script = consentBootstrapScript();

  it("is valid JavaScript, proved by compiling it", () => {
    expect(() => new Function(script)).not.toThrow();
  });

  it("reads the same storage key the settings dialog writes", () => {
    expect(script).toContain(COOKIE_STORAGE_KEY);
    expect(script).toContain(String(COOKIE_CHOICE_VERSION));
  });

  it("names every consent signal, so none is left unset before the container loads", () => {
    for (const signal of [...ALWAYS_GRANTED_SIGNALS, ...ALL_OPTIONAL_SIGNALS]) {
      expect(script, `${signal} is missing from the bootstrap script`).toContain(signal);
    }
  });

  it("sets Consent Mode defaults", () => {
    expect(script).toContain('gtag("consent","default"');
  });
});

describe("COOKIE_CATEGORY_COPY", () => {
  it("has one entry per category, in the same order", () => {
    expect(COOKIE_CATEGORY_COPY.map((entry) => entry.id)).toEqual([...COOKIE_CATEGORIES]);
  });

  it("locks Necessary and only Necessary — the switch a visitor cannot turn off", () => {
    for (const entry of COOKIE_CATEGORY_COPY) {
      expect(entry.locked, `${entry.id}.locked`).toBe(entry.id === "necessary");
    }
    expect(COOKIE_CATEGORY_COPY.find((entry) => entry.id === "necessary")?.locked).toBe(true);
  });

  it("every category has a name and a description beside its switch", () => {
    for (const entry of COOKIE_CATEGORY_COPY) {
      expect(entry.name.trim(), `${entry.id} has no name`).not.toBe("");
      expect(entry.description.trim(), `${entry.id} has no description`).not.toBe("");
    }
  });
});
