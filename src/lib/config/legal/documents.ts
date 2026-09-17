
export const LEGAL_SLUGS = [
  "legal-terms",
  "privacy-policy",
  "marketing-terms",
  "cookie-policy",
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export interface LegalDocument {
  readonly slug: LegalSlug;
  readonly title: string;
  readonly ordinal: number;
  readonly lastUpdated?: string;
  readonly paragraphs: readonly string[];
}

export const LEGAL_TEXTS_VERSION = "1.3";

export const LEGAL_TEXTS_DATE = "2026-08-29";

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  {
    slug: "legal-terms",
    title: "Legal Terms",
    ordinal: 1,
    paragraphs: [
      "By joining the WellPlace waitlist, you are registering your interest only. Joining does not guarantee a booking, membership, price, opening date or priority. Please provide accurate information and do not misuse the website. These terms are governed by the laws of the United Arab Emirates and the Emirate of Dubai.",
    ],
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    ordinal: 2,
    paragraphs: [
      "This is sample copy for a demo application. WellPlace Demo, Lantern Court, 48 Marina Walk, Business Bay, Dubai, United Arab Emirates, is the fictional operator named as responsible for personal data. No real personal data is collected or processed by this demo.",
      "We collect information submitted or generated through the website and platform. This may include your title, name, email address, mobile number, date of birth, account details, bookings, selected suites or services, dates and times, guest details, add-ons and preferences, communications, payment status and transaction references, consent records, referral and campaign information, and website and platform usage.",
      "We use this information to manage the waitlist, accounts, bookings, payments and customer service; provide and improve our services; communicate with you; understand customer interest; measure and optimise marketing; prevent misuse; and protect the website and platform. We collect your date of birth to understand the age profile of people interested in WellPlace and to improve our services and marketing. We do not collect health data. For the Health Risks document, we store only the acceptance, timestamp and document version.",
      "In this demo no third-party processor is contacted: the database runs locally, email and messaging are written to the server log instead of being sent, and checkout is a built-in simulator. A production deployment would list its hosting, database, email, messaging and payment providers here, along with the regions they process data in. Full payment-card details would be handled by the payment provider and never stored by WellPlace.",
      "To improve advertising measurement, attribution, retargeting and audience matching, WellPlace may share all technically supported website and platform data with advertising providers such as Meta, Google and TikTok. This may include your title, name, email address, mobile number, date of birth, account and consent status, booking and transaction information, selected services, referral and campaign information, and relevant website and platform activity. Where supported, personal identifiers are normalised and securely hashed before transmission. Full payment-card details and login credentials are never transmitted for advertising purposes.",
      "We retain waitlist and marketing data for a maximum of 24 months from the last interaction, unless it is deleted earlier following a valid request. Booking, payment and business records may be retained for longer where required for service, accounting, dispute or legal purposes. To access, correct or delete your data, or withdraw from marketing, contact privacy@wellplace.example.",
    ],
  },
  {
    slug: "marketing-terms",
    title: "Marketing Terms",
    ordinal: 3,
    paragraphs: [
      "By ticking the marketing consent checkbox when joining the waitlist, creating an account or making a booking, you agree to receive WellPlace news, opening updates and offers by email and WhatsApp. You can opt out at any time through the unsubscribe or opt-out option in a message or by contacting privacy@wellplace.example.",
    ],
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    ordinal: 4,
    lastUpdated: "Last updated: 29 August 2026",
    paragraphs: [
      "WellPlace uses cookies, pixels, tags, local storage and similar technologies to operate and secure the website, remember preferences, understand visitor activity and measure marketing.",
      "Necessary, preference, analytics and marketing technologies may start automatically when a visitor enters the website. These may include Google Tag Manager, Google Analytics 4, Google Ads, Meta Pixel and TikTok Pixel.",
      "These technologies may collect device and browser information, IP address, approximate location, visited pages, content sections and categories, clicks, searches, media interactions, referral and campaign information, form and account activity, availability checks, suite and service selections, add-ons, checkout and payment steps, bookings, changes, cancellations, refunds and other conversions.",
      "Advanced Matching and comparable advertising features may use all technically supported data collected across the complete website and platform, including your title, name, email address, mobile number, date of birth, account and consent status, booking and transaction information, selected services, referral and campaign information, and relevant website and platform activity. This information may be used to match activity with advertising-platform accounts, measure conversions, build audiences and improve campaign targeting. Where supported, personal identifiers are normalised and securely hashed before transmission. Full payment-card details and login credentials are never used for advertising matching.",
      "Visitors can review and change the future use of non-essential technologies at any time through Cookie Settings in the website footer. Necessary technologies remain active. Existing cookies can also be deleted through the visitor's browser.",
      "Some technology providers may process information outside the United Arab Emirates under their own privacy terms. For questions, contact privacy@wellplace.example.",
    ],
  },] as const;

export const LEGAL_DOCUMENTS_BY_SLUG: Readonly<
  Record<LegalSlug, LegalDocument>
> = Object.assign(
  Object.create(null) as Record<LegalSlug, LegalDocument>,
  Object.fromEntries(
    LEGAL_DOCUMENTS.map((document) => [document.slug, document]),
  ) as Record<LegalSlug, LegalDocument>,
);

export const LEGAL_INDEX_HREF = "/legal";

export function legalHref(slug: LegalSlug): string {
  return `${LEGAL_INDEX_HREF}#${slug}`;
}

export function isLegalSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

export function findLegalDocument(slug: string): LegalDocument | undefined {
  return isLegalSlug(slug) ? LEGAL_DOCUMENTS_BY_SLUG[slug] : undefined;
}
