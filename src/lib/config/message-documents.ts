import {
  text,
  variable,
  variableToken,
  type AuthoredBlock,
  type AuthoredDocument,
  type LinkableNode,
} from "@/lib/domain/email/document";

export const SYSTEM_MESSAGE_KEYS = [
  "waitlist_confirmation",
  "waitlist_signup_notification",
  "staff_invitation",
  "staff_password_reset",
  "contact_acknowledgement",
  "contact_notification",
  "booking_confirmation",
  "payment_received",
  "payment_failed",
  "booking_rescheduled",
  "booking_cancelled",
  "refund_issued",
  "booking_reminder",
  "directions_and_parking",
  "review_request",
  "secure_link",
  "payment_link",
  "invoice_issued",
] as const;

export type SystemMessageKey = (typeof SYSTEM_MESSAGE_KEYS)[number];

export const MESSAGE_AUDIENCES = ["guest", "staff"] as const;

export type MessageAudience = (typeof MESSAGE_AUDIENCES)[number];

export const MESSAGE_DOCUMENT_GROUPS = [
  { value: "waitlist", label: "Waitlist" },
  { value: "booking", label: "Booking updates" },
  { value: "payments", label: "Payments" },
  { value: "visit", label: "Visit messages" },
  { value: "enquiries", label: "Enquiries" },
  { value: "staff", label: "Staff access" },
] as const;

export type MessageDocumentGroup = (typeof MESSAGE_DOCUMENT_GROUPS)[number]["value"];

export interface MessageVariable {
  readonly name: string;
  readonly label: string;
  readonly sample: string;
}

export interface SystemMessageSpec {
  readonly key: SystemMessageKey;
  readonly label: string;
  readonly group: MessageDocumentGroup;
  readonly audience: MessageAudience;
  readonly trigger: string;
  readonly connected: boolean;
  readonly variables: readonly MessageVariable[];
}

function guestName(): MessageVariable {
  return { name: "first_name", label: "First name", sample: "Layla" };
}

function guestEmail(): MessageVariable {
  return { name: "email", label: "Email address", sample: "layla@example.com" };
}

export const MESSAGE_VARIABLE_GROUPS = [
  { label: "Customer details", names: ["salutation", "first_name", "last_name", "full_name", "email", "phone", "phone_country", "date_of_birth", "age"] },
  { label: "Booking & dates", names: ["reference", "starts_at", "ends_at", "adults", "children", "joined_at", "hold_expires_at"] },
  { label: "Prices & payments", names: ["amount", "tax_label", "tax_amount", "refund_amount", "invoice_number"] },
  { label: "Message & access", names: ["message", "role", "invited_by", "link_lifetime"] },
  { label: "Source & campaign", names: ["source", "campaign", "referrer", "utm_source", "utm_medium", "utm_content", "utm_term"] },
  { label: "Links", names: ["receipt_url", "console_url", "action_url"] },
] as const;

export function messageVariableGroup(name: string): string {
  return MESSAGE_VARIABLE_GROUPS.find((group) =>
    (group.names as readonly string[]).includes(name),
  )?.label ?? "Other details";
}

export function messageVariableKeywords(name: string): string[] {
  const aliases: Readonly<Record<string, readonly string[]>> = {
    phone: ["mobile", "telephone", "number"],
    date_of_birth: ["birthday", "dob", "birth date"],
    amount: ["amount", "cost", "price", "total"],
  };
  return [name.replaceAll("_", " "), messageVariableGroup(name), ...(aliases[name] ?? [])];
}

const CUSTOMER_VARIABLES: readonly MessageVariable[] = [
  guestName(),
  { name: "last_name", label: "Last name", sample: "Haddad" },
  { name: "full_name", label: "Full name", sample: "Layla Haddad" },
  guestEmail(),
  { name: "phone", label: "Phone number", sample: "+971 50 123 4567" },
  { name: "phone_country", label: "Phone country code", sample: "AE" },
];

const WAITLIST_VARIABLES: readonly MessageVariable[] = [
  ...CUSTOMER_VARIABLES.map((entry) => entry.name === "full_name"
    ? { ...entry, sample: "Ms Layla Haddad" } : entry),
  { name: "salutation", label: "Title", sample: "Ms" },
  { name: "date_of_birth", label: "Date of birth", sample: "4 October 1995" },
  { name: "age", label: "Age at signup", sample: "30" },
  { name: "joined_at", label: "Joined", sample: "12 September 2026, 15:04" },
];

const CONTACT_VARIABLES: readonly MessageVariable[] = [
  ...CUSTOMER_VARIABLES,
  { name: "message", label: "Their message", sample: "Do you open on Fridays?" },
];

const BOOKING_VARIABLES: readonly MessageVariable[] = [
  guestName(),
  guestEmail(),
  { name: "reference", label: "Booking reference", sample: "WP-B1001" },
  { name: "starts_at", label: "Visit start", sample: "Saturday 4 October, 14:00" },
  { name: "ends_at", label: "Visit end", sample: "Saturday 4 October, 18:00" },
  { name: "adults", label: "Adults", sample: "2" },
  { name: "children", label: "Children", sample: "1" },
  { name: "amount", label: "Total price", sample: "AED 1,695.00" },
  { name: "tax_label", label: "Tax name", sample: "VAT" },
  { name: "tax_amount", label: "Tax included", sample: "AED 80.71" },
  { name: "receipt_url", label: "Receipt link", sample: "https://wellplace.example/book/receipt/…" },
];

export const SYSTEM_MESSAGES: readonly SystemMessageSpec[] = [
  {
    key: "waitlist_confirmation",
    label: "Waitlist welcome",
    group: "waitlist",
    audience: "guest",
    trigger: "Sent to the guest the moment they join the waitlist.",
    connected: true,
    variables: WAITLIST_VARIABLES,
  },
  {
    key: "waitlist_signup_notification",
    label: "New waitlist signup",
    group: "waitlist",
    audience: "staff",
    trigger: "Sent to the operations mailbox when someone joins the waitlist.",
    connected: true,
    variables: [
      ...WAITLIST_VARIABLES,
      { name: "source", label: "Source", sample: "instagram" },
      { name: "campaign", label: "Campaign", sample: "opening-teaser" },
      { name: "utm_source", label: "Campaign source", sample: "instagram" },
      { name: "utm_medium", label: "Campaign medium", sample: "social" },
      { name: "utm_content", label: "Campaign content", sample: "welcome-post" },
      { name: "utm_term", label: "Campaign term", sample: "private wellness" },
      { name: "referrer", label: "Referring page", sample: "https://wellplace.example/" },
      { name: "console_url", label: "Console link", sample: "https://wellplace.example/manage/waitlist" },
    ],
  },
  {
    key: "staff_invitation",
    label: "Console invitation",
    group: "staff",
    audience: "staff",
    trigger: "Sent when Management invites a colleague to the console.",
    connected: true,
    variables: [
      { name: "full_name", label: "Full name", sample: "Omar Khalil" },
      guestEmail(),
      { name: "role", label: "Access", sample: "Reception" },
      { name: "invited_by", label: "Invited by", sample: "Layla Haddad" },
      { name: "action_url", label: "Set-password link", sample: "https://wellplace.example/set-password?…" },
      { name: "link_lifetime", label: "How long the link lasts", sample: "24 hours" },
    ],
  },
  {
    key: "staff_password_reset",
    label: "Console password reset",
    group: "staff",
    audience: "staff",
    trigger: "Sent when a colleague asks for a new console password.",
    connected: true,
    variables: [
      { name: "full_name", label: "Full name", sample: "Omar Khalil" },
      guestEmail(),
      { name: "action_url", label: "Reset link", sample: "https://wellplace.example/set-password?…" },
      { name: "link_lifetime", label: "How long the link lasts", sample: "24 hours" },
    ],
  },
  {
    key: "contact_acknowledgement",
    label: "Enquiry received",
    group: "enquiries",
    audience: "guest",
    trigger: "Sent to the visitor who used the website contact form.",
    connected: true,
    variables: CONTACT_VARIABLES,
  },
  {
    key: "contact_notification",
    label: "New website enquiry",
    group: "enquiries",
    audience: "staff",
    trigger: "Sent to the operations mailbox when the contact form is used.",
    connected: true,
    variables: CONTACT_VARIABLES,
  },
  {
    key: "booking_confirmation",
    label: "Booking confirmed",
    group: "booking",
    audience: "guest",
    trigger: "Sent once a payment is confirmed by the provider. It still goes out with WellPlace's built-in wording — editing it here does not change it yet.",
    connected: true,
    variables: BOOKING_VARIABLES,
  },
  {
    key: "payment_failed",
    label: "Payment unsuccessful",
    group: "payments",
    audience: "guest",
    trigger: "Sent when a payment attempt does not complete. It still goes out with WellPlace's built-in wording — editing it here does not change it yet.",
    connected: true,
    variables: [
      ...BOOKING_VARIABLES,
      { name: "hold_expires_at", label: "Hold expires", sample: "14:12" },
    ],
  },
  {
    key: "refund_issued",
    label: "Refund issued",
    group: "payments",
    audience: "guest",
    trigger: "Sent when a refund is recorded against a booking. It still goes out with WellPlace's built-in wording — editing it here does not change it yet.",
    connected: true,
    variables: [
      ...BOOKING_VARIABLES,
      { name: "refund_amount", label: "Refund amount", sample: "AED 660.00" },
    ],
  },
  {
    key: "invoice_issued",
    label: "Tax invoice",
    group: "payments",
    audience: "guest",
    trigger: "Sent when Management issues a tax invoice. It still goes out with WellPlace's built-in wording — editing it here does not change it yet.",
    connected: true,
    variables: [
      ...BOOKING_VARIABLES,
      { name: "invoice_number", label: "Invoice number", sample: "INV-000142" },
    ],
  },
  {
    key: "payment_received",
    label: "Payment received",
    group: "payments",
    audience: "guest",
    trigger: "No send path is connected yet.",
    connected: false,
    variables: BOOKING_VARIABLES,
  },
  {
    key: "booking_rescheduled",
    label: "Booking time changed",
    group: "booking",
    audience: "guest",
    trigger: "No send path is connected yet.",
    connected: false,
    variables: BOOKING_VARIABLES,
  },
  {
    key: "booking_cancelled",
    label: "Booking cancelled",
    group: "booking",
    audience: "guest",
    trigger: "No send path is connected yet.",
    connected: false,
    variables: BOOKING_VARIABLES,
  },
  {
    key: "booking_reminder",
    label: "Visit reminder",
    group: "visit",
    audience: "guest",
    trigger: "No send path is connected yet.",
    connected: false,
    variables: BOOKING_VARIABLES,
  },
  {
    key: "directions_and_parking",
    label: "Directions and parking",
    group: "visit",
    audience: "guest",
    trigger: "No send path is connected yet.",
    connected: false,
    variables: BOOKING_VARIABLES,
  },
  {
    key: "review_request",
    label: "Ask for a review",
    group: "visit",
    audience: "guest",
    trigger: "No send path is connected yet. Marketing — stops when marketing is switched off.",
    connected: false,
    variables: BOOKING_VARIABLES,
  },
  {
    key: "secure_link",
    label: "Booking details link",
    group: "booking",
    audience: "guest",
    trigger: "No send path is connected yet.",
    connected: false,
    variables: BOOKING_VARIABLES,
  },
  {
    key: "payment_link",
    label: "Request a payment",
    group: "payments",
    audience: "guest",
    trigger: "No send path is connected yet.",
    connected: false,
    variables: BOOKING_VARIABLES,
  },
];

export function messageSpec(key: SystemMessageKey): SystemMessageSpec {
  const found = SYSTEM_MESSAGES.find((entry) => entry.key === key);
  if (found === undefined) throw new Error(`Unknown message template: ${key}`);
  return found;
}

export function isSystemMessageKey(value: string): value is SystemMessageKey {
  return SYSTEM_MESSAGES.some((entry) => entry.key === value);
}

export function variableCatalogue(key: SystemMessageKey): readonly string[] {
  return messageSpec(key).variables.map((entry) => entry.name);
}

export function sampleValues(key: SystemMessageKey): Readonly<Record<string, string>> {
  return Object.fromEntries(messageSpec(key).variables.map((entry) => [entry.name, entry.sample]));
}

let sequence = 0;

function id(kind: string): string {
  sequence += 1;
  return `${kind}-${sequence}`;
}

function eyebrow(value: string): AuthoredBlock {
  return { kind: "eyebrow", id: id("eyebrow"), content: [text(value)] };
}

function heading(...content: LinkableNode[]): AuthoredBlock {
  return { kind: "heading", id: id("heading"), content };
}

function lead(value: string): AuthoredBlock {
  return { kind: "lead", id: id("lead"), content: [text(value)] };
}

function paragraph(value: string): AuthoredBlock {
  return {
    kind: "text",
    id: id("text"),
    content: [text(value)],
    align: "left",
    size: "normal",
  };
}

function note(value: string): AuthoredBlock {
  return { kind: "note", id: id("note"), content: [text(value)] };
}

function button(label: string, href: string): AuthoredBlock {
  return { kind: "button", id: id("button"), label: [text(label)], href };
}

function panel(rows: readonly (readonly [string, string])[]): AuthoredBlock {
  return {
    kind: "panel",
    id: id("panel"),
    rows: rows.map(([label, name]) => ({ label: [text(label)], value: [variable(name)] })),
  };
}

const DEFAULTS: Readonly<Record<SystemMessageKey, AuthoredDocument | null>> = {
  waitlist_confirmation: {
    subject: [text("You’re in — welcome to the WellPlace waitlist")],
    preheader: [text("Your private wellness experience in Dubai is getting closer.")],
    blocks: [
      eyebrow("Waitlist confirmed"),
      heading(text("You’re in, "), variable("first_name")),
      lead("Welcome to the WellPlace waitlist."),
      paragraph(
        "We’re creating a first-of-its-kind private wellness experience in Dubai — designed around complete privacy, freedom and time that truly belongs to you.",
      ),
      paragraph(
        "No shared facilities. No strangers. No interruptions. Just your own space, your own pace and the people you choose to bring.",
      ),
      paragraph(
        "Until opening, we’ll share exclusive first looks, behind-the-scenes updates and important booking news. As part of the waitlist, you’ll be among the first to know when bookings open and receive priority access.",
      ),
    ],
  },
  waitlist_signup_notification: {
    subject: [text("New waitlist signup — "), variable("full_name")],
    preheader: [],
    blocks: [
      eyebrow("New waitlist signup"),
      heading(variable("full_name"), text(" joined the waitlist")),
      panel([
        ["Name", "full_name"],
        ["Email", "email"],
        ["Mobile", "phone"],
        ["Joined", "joined_at"],
        ["Source", "source"],
        ["Campaign", "campaign"],
      ]),
      paragraph("Open the Management console to see the full list, filter it, and export it."),
      button("Open the waitlist", variableToken("console_url")),
      note("To answer the guest, write to the address shown above."),
    ],
  },
  staff_invitation: {
    subject: [text("Set your WellPlace console password")],
    preheader: [text("Choose a password and your access is ready.")],
    blocks: [
      eyebrow("Console invitation"),
      heading(text("Welcome, "), variable("full_name")),
      {
        kind: "lead",
        id: id("lead"),
        content: [variable("invited_by"), text(" added you to the WellPlace console.")],
      },
      panel([
        ["Sign in as", "email"],
        ["Access", "role"],
      ]),
      {
        kind: "text",
        id: id("text"),
        content: [
          text("Choose a password to finish setting up your account. The link below works once and lasts "),
          variable("link_lifetime"),
          text(" — if it has expired, ask whoever invited you to send it again."),
        ],
        align: "left",
        size: "normal",
      },
      button("Set your password", variableToken("action_url")),
      note(
        "If the link has expired, open the console and use “Forgot your password?” to send yourself a new one.",
      ),
    ],
  },
  staff_password_reset: {
    subject: [text("Reset your WellPlace console password")],
    preheader: [text("Choose a new password for the WellPlace console.")],
    blocks: [
      eyebrow("Password reset"),
      heading(text("Hello, "), variable("full_name")),
      {
        kind: "text",
        id: id("text"),
        content: [
          text("Use the button below to choose a new password. The link works once and lasts "),
          variable("link_lifetime"),
          text("."),
        ],
        align: "left",
        size: "normal",
      },
      button("Choose a new password", variableToken("action_url")),
      note("Nobody at WellPlace can see your password, and we will never ask you for it."),
    ],
  },
  contact_acknowledgement: {
    subject: [text("We’ve received your message — WellPlace")],
    preheader: [text("Thank you for writing to WellPlace — we’ll reply as soon as we can.")],
    blocks: [
      eyebrow("Message received"),
      heading(text("Thank you, "), variable("first_name")),
      lead("Your message has reached the WellPlace team."),
      paragraph(
        "We read every enquiry ourselves and will reply as soon as we can. In the meantime, you can find out more about WellPlace on our website and social channels.",
      ),
      { kind: "divider", id: id("divider") },
      note("This is what you sent us:"),
      { kind: "text", id: id("text"), content: [variable("message")], align: "left", size: "normal" },
    ],
  },
  contact_notification: {
    subject: [text("New contact enquiry — "), variable("full_name")],
    preheader: [],
    blocks: [
      eyebrow("Website enquiry"),
      heading(variable("full_name"), text(" sent a message")),
      panel([
        ["Name", "full_name"],
        ["Email", "email"],
        ["Mobile", "phone"],
      ]),
      { kind: "divider", id: id("divider") },
      { kind: "text", id: id("text"), content: [variable("message")], align: "left", size: "normal" },
      note("Use the email address above to reply to this enquiry."),
    ],
  },
  booking_confirmation: {
    subject: [text("Your WellPlace booking is confirmed")],
    preheader: [text("Your private suite is reserved. Your receipt is inside.")],
    blocks: [
      eyebrow("Booking confirmed"),
      heading(text("You’re booked, "), variable("first_name")),
      lead("Thank you for booking with WellPlace. Your private suite is reserved for the time below."),
      panel([
        ["Reference", "reference"],
        ["Arrive", "starts_at"],
        ["Until", "ends_at"],
        ["Adults", "adults"],
        ["Children", "children"],
        ["Paid", "amount"],
      ]),
      button("View your receipt", variableToken("receipt_url")),
    ],
  },
  payment_failed: {
    subject: [text("Your WellPlace payment did not go through")],
    preheader: [text("No money was taken. You can try again.")],
    blocks: [
      eyebrow("Payment not completed"),
      heading(text("Your payment did not go through, "), variable("first_name")),
      lead(
        "Your payment was not completed, so nothing has been charged. You can return to the booking page and try again.",
      ),
      {
        kind: "note",
        id: id("note"),
        content: [
          text("Your time is held until "),
          variable("hold_expires_at"),
          text(" (Dubai time). Complete your payment before then to keep it."),
        ],
      },
    ],
  },
  refund_issued: {
    subject: [text("Your WellPlace refund")],
    preheader: [text("Details of the refund on your booking.")],
    blocks: [
      eyebrow("Refund"),
      heading(text("About your refund, "), variable("first_name")),
      lead(
        "We have issued a refund on your booking. Card refunds usually reach your account within a few working days, depending on your bank.",
      ),
      panel([
        ["Reference", "reference"],
        ["Refunded", "refund_amount"],
      ]),
    ],
  },
  invoice_issued: null,
  payment_received: null,
  booking_rescheduled: null,
  booking_cancelled: null,
  booking_reminder: null,
  directions_and_parking: null,
  review_request: null,
  secure_link: null,
  payment_link: null,
};

export function defaultDocument(key: SystemMessageKey): AuthoredDocument | null {
  return DEFAULTS[key];
}

export const MESSAGE_DOCUMENT_LIMITS = {
  blocksMax: 60,
  panelRowsMax: 20,
  linkItemsMax: 10,
  inlineNodesMax: 200,
  textMax: 4000,
  htmlMax: 20000,
  templateNameMax: 80,
  hrefMax: 2000,
  altMax: 300,
} as const;

export const TEST_RECIPIENT_HINT =
  "Preview with sample details, then choose an email address to receive a test.";

export const MESSAGE_EDITOR = {
  autosaveDelayMs: 2500,
  recoveryDelayMs: 500,
  recoveryStoragePrefix: "wellplace-message-recovery",
  historyDepth: 50,
  coalesceMs: 700,
  savedBlocksMax: 30,
  savedBlockNameMax: 80,
  savedBlocksStorageKey: "wellplace-message-saved-blocks",
  dragMime: "application/x-wellplace-message-block",
} as const;
