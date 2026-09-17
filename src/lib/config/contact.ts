export const CONTACT_PAGE_CONTENT = {
  title: "Contact & reservations",
  description:
    "Questions about the suites, a private group or visiting WellPlace? Send a note and our team will get back to you.",
  hero: {
    eyebrow: "We're here to help",
    title: "Contact",
    accent: "us",
    image: "/renderings/reception-sitting-areaa-view-1-1920.webp",
    imageAlt: "The WellPlace reception, framed by warm stone and soft light",
  },
  form: {
    heading: "Send us a message",
    description: "Tell us what you are planning and how we can help.",
    firstNameLabel: "First name",
    firstNamePlaceholder: "Your first name",
    lastNameLabel: "Last name",
    lastNamePlaceholder: "Your last name",
    emailLabel: "Email",
    emailPlaceholder: "name@example.com",
    phoneLabel: "Mobile number (optional)",
    messageLabel: "Message",
    messagePlaceholder: "Tell us a little about what you are looking for…",
    invalidBanner: "Please check the highlighted fields and try again.",
    submitLabel: "Send message",
    pendingLabel: "Sending message",
    successHeading: "Your message is on its way",
    successDescription:
      "Thank you for getting in touch. The WellPlace team will reply as soon as possible.",
    resetLabel: "Send another message",
    sentTitle: "Message sent",
    sentBody: "The WellPlace team will get back to you as soon as possible.",
    rateLimitedTitle: "Too many messages",
    rateLimitedBody: "Please wait a while before trying again.",
    errorTitle: "Your message could not be sent",
    errorBody: "Please try again or use one of the contact options beside the form.",
  },
  methods: {
    heading: "Talk to our team",
    description: "Choose the contact option that suits you best.",
    loadingLabel: "Loading contact options",
    emailTitle: "Email us",
    emailFallback: "Use the form and our team will reply by email.",
    visitTitle: "Visit us",
    directionsLabel: "Get directions",
    hoursTitle: "Opening hours",
    unpublishedHours: "Opening hours will be published before launch.",
    closedLabel: "Closed",
  },
} as const;

export const CONTACT_FORM_LIMITS = {
  nameMax: 80,
  emailMax: 254,
  messageMin: 10,
  messageMax: 2_000,
} as const;

export const CONTACT_WEEKDAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;
