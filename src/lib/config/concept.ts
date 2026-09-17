export interface ConceptChapter {
  readonly number: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly accent: string;
  readonly body: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly details: readonly string[];
  readonly mediaSide: "left" | "right";
}

export const CONCEPT_PAGE_CONTENT = {
  title: "Concept & experience",
  description:
    "Discover the WellPlace concept: private wellness suites in Dubai designed for uninterrupted time and the people you choose.",
  hero: {
    eyebrow: "The WellPlace concept",
    title: "Concept",
    accent: "& experience",
    body: "A private wellness experience shaped around uninterrupted time, calm surroundings and the people you choose.",
    image: "/renderings/staircase-corridor-upstair-02-1920.webp",
    imageAlt: "The softly lit WellPlace staircase leading toward the private suites",
  },
} as const;

export const CONCEPT_CHAPTERS: readonly ConceptChapter[] = [
  {
    number: "01",
    eyebrow: "The threshold",
    title: "Privacy begins",
    accent: "at the door",
    body: "The entire suite is reserved only for you and the people you choose. Step inside, close the door and enjoy uninterrupted time together.",
    image: "/renderings/reception-sitting-areaa-view-1-1920.webp",
    imageAlt: "The WellPlace reception framed by warm stone, timber and soft light",
    details: [
      "The entire suite is reserved for one booking at a time.",
      "Only you and the people you choose.",
      "Close the door and the world stays outside.",
    ],
    mediaSide: "right",
  },
  {
    number: "02",
    eyebrow: "The experience",
    title: "Everything within",
    accent: "one private suite",
    body: "Heat, cold, water and deep relaxation come together behind one door. Move between your Finnish sauna, cold plunge, whirlpool and relaxation lounge without entering a shared area.",
    image: "/renderings/suite-view-1-1920.webp",
    imageAlt: "A private WellPlace suite prepared with a lounge, warm timber and stone",
    details: [
      "Finnish sauna and cold plunge.",
      "Whirlpool and relaxation lounge.",
      "Not one shared area in between.",
    ],
    mediaSide: "left",
  },
  {
    number: "03",
    eyebrow: "The rhythm",
    title: "Time that follows",
    accent: "your pace",
    body: "Choose two to six hours and make the experience your own. Set the climate, lighting, sound and integrated media to suit your mood, then unwind at your own pace.",
    image: "/renderings/suite-view-6-1920.webp",
    imageAlt: "A private wellness suite with a whirlpool and soft lighting",
    details: [
      "Two to six hours, entirely yours.",
      "Climate, lighting, sound and media, set by you.",
      "Nothing to rush and no one waiting outside.",
    ],
    mediaSide: "right",
  },
];

export const CONCEPT_STORY_LABELS = {
  indexTitle: "Inside the story",
  begin: "Begin chapter",
  chapter: "Chapter",
  of: "of",
} as const;

export const CONCEPT_FINALE = {
  number: "04",
  title: "The final chapter",
  accent: "is yours to write",
  body: "Everything you have just read waits behind one private door, reserved for one booking at a time. Choose your date, your hours and who joins you.",
  primaryLabel: "Book now",
} as const;
