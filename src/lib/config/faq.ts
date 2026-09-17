import { MARKETING_BOOK_HREF, MARKETING_ROUTES } from "@/lib/config/marketing";

export interface MarketingFaqEntry {
  readonly q: string;
  readonly a: string;
}

export interface MarketingFaqGroup {
  readonly id: string;
  readonly title: string;
  readonly entries: readonly MarketingFaqEntry[];
}

export const FAQ_PAGE_CONTENT = {
  title: "Frequently asked questions",
  description:
    "Answers to common questions about WellPlace private wellness suites, bookings and visits in Dubai.",
  hero: {
    title: "Frequently asked",
    accent: "questions",
    body: "Find the essentials for planning your private WellPlace visit. If you still need help, our team is close by.",
    primaryLabel: "Check availability and pricing",
    primaryHref: MARKETING_BOOK_HREF,
    secondaryLabel: "Contact us",
    secondaryHref: MARKETING_ROUTES.contact.href,
  },
  emptyLabel:
    "Questions are on their way. In the meantime, message the team and we will answer anything you need.",
} as const;

export const FAQ_SHOW_ON_HOME_WHEN_UNSET = false;

export const FAQ_GROUP_EXPERIENCE = "The WellPlace experience";
export const FAQ_GROUP_VISIT = "Planning your visit";
export const FAQ_GROUP_BOOKINGS = "Bookings and support";

export interface FaqQuestion {
  readonly question: string;
  readonly answer: string;
  readonly group: string;
  readonly showOnHome: boolean;
}

export const FAQ_QUESTIONS: readonly FaqQuestion[] = [
  {
    question: "What is WellPlace?",
    answer: "WellPlace is a first-of-its-kind private wellness concept in the UAE. Each complete suite is reserved for one booking at a time, bringing heat, cold, water and deep relaxation together behind one private door.",
    group: FAQ_GROUP_EXPERIENCE,
    showOnHome: true,
  },
  {
    question: "What is included in a suite?",
    answer: "Your suite includes a private Finnish sauna with self-guided Aufguss rituals, cold plunge, whirlpool, experience shower, bathroom and toilet, in-suite service hatch, relaxation lounge, and personal controls for climate, lighting, sound and integrated media.",
    group: FAQ_GROUP_EXPERIENCE,
    showOnHome: true,
  },
  {
    question: "Is the suite shared?",
    answer: "No. The complete suite is reserved exclusively for the people included in your booking. You never share it with other guests.",
    group: FAQ_GROUP_EXPERIENCE,
    showOnHome: true,
  },
  {
    question: "How many guests can attend?",
    answer: "Each booking is for two to five guests in total, including children. Every guest is charged according to their guest category and the selected duration.",
    group: FAQ_GROUP_VISIT,
    showOnHome: false,
  },
  {
    question: "What are the age rules?",
    answer: "The lead booker must be at least 18. Guests aged 16 and over use the adult rate. Children aged 8 to 15 are welcome at the child rate. Children under 8 cannot be added.",
    group: FAQ_GROUP_VISIT,
    showOnHome: false,
  },
  {
    question: "How long can a suite be booked?",
    answer: "Choose two, three, four, five or six hours. The minimum booking is two guests for two hours. WellPlace offers timed wellness sessions, not overnight accommodation.",
    group: FAQ_GROUP_BOOKINGS,
    showOnHome: false,
  },
  {
    question: "Is parking available?",
    answer:
      "Yes. Complimentary parking is available on site in Business Bay, and detailed arrival information is provided with your booking confirmation.",
    group: FAQ_GROUP_VISIT,
    showOnHome: true,
  },
  {
    question: "How are drinks and snacks delivered?",
    answer: "Order drinks and light snacks from inside your suite. Orders arrive through a discreet service hatch, so no WellPlace team member needs to enter and your privacy remains uninterrupted.",
    group: FAQ_GROUP_EXPERIENCE,
    showOnHome: false,
  },
  {
    question: "Can a booking be changed or cancelled?",
    answer: "You can cancel up to 24 hours before your booking starts. Rescheduling is available up to 30 minutes before the start, subject to availability. Contact the team through WhatsApp if you need help.",
    group: FAQ_GROUP_BOOKINGS,
    showOnHome: false,
  },
  {
    question: "Is overnight accommodation available?",
    answer: "No. WellPlace provides private timed wellness sessions and is not overnight accommodation.",
    group: FAQ_GROUP_VISIT,
    showOnHome: false,
  },
  {
    question: "Do I need an account to make a booking?",
    answer:
      "No. You can choose a suite, enter your details and complete your booking without creating a customer account.",
    group: FAQ_GROUP_BOOKINGS,
    showOnHome: false,
  },
  {
    question: "How can I contact WellPlace?",
    answer:
      "You can message the team through WhatsApp or use the contact and location information on the website. We will help with booking and visit questions.",
    group: FAQ_GROUP_BOOKINGS,
    showOnHome: false,
  },
];

export function faqGroupId(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `group-${index + 1}`;
}

export const FAQ_KNOWLEDGE_BASE_LABELS = {
  topics: "Topics",
} as const;

export const FAQ_GROUP_DESCRIPTIONS: Readonly<Record<string, string>> = {
  [FAQ_GROUP_EXPERIENCE]: "What a private suite includes and how your time inside it works.",
  [FAQ_GROUP_VISIT]: "Guests, age rules, parking and what a visit covers.",
  [FAQ_GROUP_BOOKINGS]: "Booking lengths, changes and how to reach the team.",
};

export function faqGroupDescription(title: string, count: number): string {
  return FAQ_GROUP_DESCRIPTIONS[title] ?? `${count} ${count === 1 ? "question" : "questions"} answered`;
}
