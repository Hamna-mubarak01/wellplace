import { MARKETING_BOOK_HREF } from "@/lib/config/marketing";

export const RESERVATION_PAGES = [
  { value: "home", label: "Home", route: "/" },
  { value: "suites", label: "Suites & facilities", route: "/suites" },
  { value: "book", label: "Booking process", route: "/book" },
  { value: "faq", label: "FAQ", route: "/faq" },
  { value: "contact", label: "Contact", route: "/contact" },
] as const;

export type ReservationPage = (typeof RESERVATION_PAGES)[number]["value"];

export const RESERVATION_ROUTES: readonly string[] = RESERVATION_PAGES.map(
  (page) => page.route,
);

export const RESERVATION_CONTENT = {
  eyebrow: "Reservations",
  title: "Ready when",
  accent: "you are",
  body: "Booking opens ahead of our Dubai launch. Reserve early and be among the first through the door.",
  primaryLabel: "Book now",
  primaryHref: MARKETING_BOOK_HREF,
  image: "/renderings/suite-view-2-960.webp",
} as const;

const RESERVATION_PLACEMENT_ON: readonly string[] = ["home", "suites"];

export const RESERVATION_ENABLED_WHEN_UNSET = true;

export const RESERVATION_PLACEMENT_DEFAULTS = RESERVATION_PAGES.map((page) => ({
  page: page.value,
  enabled: RESERVATION_PLACEMENT_ON.includes(page.value),
  eyebrow: "",
  title: "",
  accent: "",
  body: "",
  primaryLabel: "",
  image: "",
}));
