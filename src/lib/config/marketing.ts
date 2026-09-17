export interface MarketingNavigationLink {
  readonly href: string;
  readonly label: string;
}

export const MARKETING_ROUTES = {
  concept: { href: "/concept", label: "Concept" },
  suites: { href: "/suites", label: "Suites" },
  booking: { href: "/book", label: "Booking" },
  faq: { href: "/faq", label: "FAQ" },
  contact: { href: "/contact", label: "Contact" },
} as const satisfies Record<string, MarketingNavigationLink>;

export const MARKETING_NAV_LINKS: readonly MarketingNavigationLink[] = [
  MARKETING_ROUTES.concept,
  MARKETING_ROUTES.suites,
  MARKETING_ROUTES.booking,
  MARKETING_ROUTES.faq,
  MARKETING_ROUTES.contact,
];

export const MARKETING_BOOK_HREF = MARKETING_ROUTES.booking.href;
export const MARKETING_NAV_MENU_STAGGER_MS = 55;
export const MARKETING_STARTUP_LOADER_MS = 700;


export const MARKETING_SUITE_ROTATION_MS = 5_000;

// [§Owner gallery sketch, 15 Sep] Compact, looping nine-image gallery.
export const MARKETING_GALLERY_MAX_IMAGES = 9;
export const MARKETING_GALLERY_DESKTOP_MIN_WIDTH_PX = 768;
export const MARKETING_GALLERY_DEPTH = 3;
// [§Owner mobile carousel correction, 15 Sep]
export const MARKETING_CAROUSEL_SCROLL_DURATION = 36;
export const MARKETING_DIFFERENCE_AUTOPLAY_MS = 6_000;
export const MARKETING_GALLERY_SWIPE_PX = 40;
export const MARKETING_GALLERY_AUTOPLAY_MS = 1_500;
export const MARKETING_GALLERY_SWAY_PERCENT = 6;

export function galleryOffset(index: number, active: number, count: number): number {
  if (count < 2) return 0;
  const offset = ((index - active) % count + count) % count;
  return offset > count / 2 ? offset - count : offset;
}
