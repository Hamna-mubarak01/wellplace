import { LAUNCH_MODE } from "@/lib/config/seo";

export interface HomeCallToAction {
  href: string;
  label: string;
  short: string;
  bookingOpen: boolean;
}

export function resolveCallToAction(): HomeCallToAction {
  return LAUNCH_MODE === "full"
    ? { href: "/book", label: "Book your suite", short: "Book now", bookingOpen: true }
    : { href: "/waitlist", label: "Join the waitlist", short: "Join waitlist", bookingOpen: false };
}
