import { SITE_NAME } from "@/lib/config/seo";

export const LOADING_CONTENT = {
  brandText: SITE_NAME,
  startupLabel: `Opening ${SITE_NAME}.`,
  routeLabels: {
    home: "Loading WellPlace.",
    concept: "Loading the concept page.",
    suites: "Loading suites and facilities.",
    book: "Loading booking options.",
    faq: "Loading frequently asked questions.",
    contact: "Loading the contact page.",
  },
} as const;

export type LoadingRoute = keyof typeof LOADING_CONTENT.routeLabels;
