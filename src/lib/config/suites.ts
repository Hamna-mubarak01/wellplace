export interface SuiteStoryCard {
  readonly eyebrow: string;
  readonly title: string;
  readonly accent: string;
  readonly body: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly facilities: readonly string[];
}

export const SUITES_PAGE_CONTENT = {
  requirements: ["§4.3", "§3", "CONFIRMED"] as const,
  title: "Suites & facilities",
  description:
    "Step inside a fully private WellPlace suite in Dubai, with a Finnish sauna, cold plunge, whirlpool, experience shower and relaxation lounge.",
  hero: {
    eyebrow: "The WellPlace suites",
    title: "Suites",
    accent: "& facilities",
    body: "A complete private wellness suite, reserved for your guests and shaped around the time you choose.",
    image: "/renderings/suite-view-2-1920.webp",
    imageAlt: "A complete private WellPlace suite finished in warm timber and stone",
  },
  tour: {
    eyebrow: "Inside the suite",
    title: "Move through the space at",
    accent: "your pace",
    body: "Each card shows one part of the same private suite, not a separate suite. Select any card to bring it forward.",
  },
} as const;

// [§Suites content]
// Use the approved facility copy in the existing image stack. Keep the current
// image order; the two additional cards reuse renderings already in this stack.
export const SUITE_STORY_CARDS: readonly SuiteStoryCard[] = [
  {
    eyebrow: "Heat",
    title: "Private Finnish sauna",
    accent: "with self-guided Aufguss rituals",
    body: "Create your own sauna ritual with water and sauna-safe aromatic essences.",
    image: "/renderings/suite-view-1-1920.webp",
    imageAlt: "The relaxation lounge inside a private WellPlace suite",
    facilities: [
      "Self-guided rituals",
      "Water & essences",
    ],
  },
  {
    eyebrow: "Cold",
    title: "Private",
    accent: "cold plunge",
    body: "Cold immersion available inside the suite without entering a shared area.",
    image: "/renderings/suite-view-3-1920.webp",
    imageAlt: "A softly lit lounge inside a private WellPlace suite",
    facilities: [
      "Inside your suite",
      "Private cold immersion",
    ],
  },
  {
    eyebrow: "Water",
    title: "Private",
    accent: "whirlpool",
    body: "A private water experience reserved for the guests in the suite.",
    image: "/renderings/suite-view-4-1920.webp",
    imageAlt: "The warm timber wellness area inside a private WellPlace suite",
    facilities: [
      "Private water experience",
      "Reserved for your guests",
    ],
  },
  {
    eyebrow: "Refresh",
    title: "Private",
    accent: "experience shower",
    body: "An immersive shower experience within the private suite.",
    image: "/renderings/suite-view-6-1920.webp",
    imageAlt: "The whirlpool and cold plunge within a private WellPlace suite",
    facilities: [
      "Immersive shower",
      "Within your suite",
    ],
  },
  {
    eyebrow: "Comfort",
    title: "Private bathroom",
    accent: "and toilet",
    body: "All essential facilities remain inside the suite.",
    image: "/renderings/suite-view-5-1920.webp",
    imageAlt: "An elevated view across the lounge and private water areas of a WellPlace suite",
    facilities: [
      "Private facilities",
      "Inside your suite",
    ],
  },
  {
    eyebrow: "In-suite service",
    title: "Private in-suite",
    accent: "service hatch",
    body: "Guests can order drinks and light snacks from inside the suite. Orders are delivered through a discreet service hatch, so no WellPlace team member needs to enter and privacy remains uninterrupted.",
    image: "/renderings/suite-view-2-1920.webp",
    imageAlt: "A wide view of a complete private WellPlace suite",
    facilities: [
      "Drinks & light snacks",
      "Discreet delivery",
    ],
  },
  {
    eyebrow: "Relaxation",
    title: "Relaxation",
    accent: "lounge",
    body: "A comfortable area for rest, conversation and uninterrupted time.",
    image: "/renderings/suite-view-3-1920.webp",
    imageAlt: "A softly lit lounge inside a private WellPlace suite",
    facilities: [
      "Rest & conversation",
      "Uninterrupted time",
    ],
  },
  {
    eyebrow: "Your environment",
    title: "Personal",
    accent: "environment controls",
    body: "Guests control the climate, lighting, sound and integrated media experience.",
    image: "/renderings/suite-view-5-1920.webp",
    imageAlt: "An elevated view across the lounge and private water areas of a WellPlace suite",
    facilities: [
      "Climate & lighting",
      "Sound & media",
    ],
  },
];

export const SUITE_CIRCUIT_CONTENT = {
  eyebrow: "The WellPlace circuit",
  title: "Heat, cold, water, rest.",
  accent: "Then begin again.",
  body: "Every suite is built around one simple rhythm. Move through the four stages at your own pace, rest as long as you like, then start the next round. Everything happens behind your own door, so nothing interrupts the flow.",
  ringLabel: "The circuit",
  showStage: "Show",
  nowLabel: "Now",
  nextLabel: "Up next",
  roundLabel: "One round is never enough",
  stations: [
    {
      key: "heat",
      label: "Heat",
      name: "Finnish sauna",
      body: "Begin in your private Finnish sauna. Add water and a sauna-safe aromatic essence to shape your own Aufguss ritual.",
      tip: "Set the lighting and sound in the suite before you step in.",
    },
    {
      key: "cold",
      label: "Cold",
      name: "Cold plunge",
      body: "Step out of the heat and into cold immersion, right inside your suite.",
      tip: "No shared area and no waiting in between.",
    },
    {
      key: "water",
      label: "Water",
      name: "Whirlpool and experience shower",
      body: "Warm back up in your private whirlpool, or refresh under the immersive experience shower.",
      tip: "Both are reserved only for the guests in your booking.",
    },
    {
      key: "rest",
      label: "Rest",
      name: "Relaxation lounge",
      body: "Settle into the relaxation lounge, talk, and let the round sink in before you begin again.",
      tip: "Order drinks and light snacks through the service hatch, and nobody needs to enter.",
    },
  ],
} as const;

export const SUITE_CIRCUIT_STEP_MS = 5_000;

export type SuiteCircuitStation = (typeof SUITE_CIRCUIT_CONTENT.stations)[number]["key"];

export interface SuiteFacts {
  readonly hours: readonly number[] | null;
}

export function hoursList(hours: readonly number[]): string {
  const sorted = [...hours].sort((a, b) => a - b);
  if (sorted.length <= 1) return `${sorted[0] ?? ""} hours`;
  return `${sorted.slice(0, -1).join(", ")} or ${sorted.at(-1)} hours`;
}

export const SUITE_FAN_AUTOPLAY_MS = 1_500;

export const SUITE_FAN_LABELS = {
  region: "Suite facilities",
  previous: "Previous facility",
  next: "Next facility",
  show: "Show",
} as const;

export type SuiteCardIcon =
  | "flame"
  | "snowflake"
  | "waves"
  | "shower"
  | "bath"
  | "service"
  | "lounge"
  | "controls"
  | "sparkles";

export const SUITE_CARD_ICONS: Readonly<Record<string, SuiteCardIcon>> = {
  heat: "flame",
  cold: "snowflake",
  water: "waves",
  refresh: "shower",
  comfort: "bath",
  "in-suite service": "service",
  relaxation: "lounge",
  "your environment": "controls",
};

export function suiteCardIcon(eyebrow: string): SuiteCardIcon {
  return SUITE_CARD_ICONS[eyebrow.trim().toLowerCase()] ?? "sparkles";
}
