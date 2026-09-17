export const BOOKING_PROMO_CODES_LIVE = true;

export const BOOKING_PAGE_CONTENT = {
  title: "Booking process",
  description:
    "Choose a date, a session length and a start time for your private suite at WellPlace in Dubai.",
  hero: {
    eyebrow: "Private wellness, reserved for you",
    title: "Booking",
    accent: "process",
    body: "Choose the people, the time and the pace. We will guide you through the rest, one clear decision at a time.",
    image: "/renderings/suite-view-4-1920.webp",
  },
  messages: {
    widgetLabel: "Complete your booking",
    loadingLabel: "Loading booking form",
    settingsUnavailable: "We could not load booking options just now.",
    rateLimited:
      "You have checked availability a lot in a short time. Please wait a moment and try again.",
    timesUnavailable: "We could not load available times just now. Please try again.",
    systemUnreachable:
      "We could not reach the booking system. Check your connection and try again — nothing you have chosen is lost.",
    addonsUnavailable:
      "The add-on list did not load. Your dates, times and details are unaffected.",
  },
} as const;
