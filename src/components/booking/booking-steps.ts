
export const BOOKING_STEP_IDS = [
  "details",
  "when",
  "addons",
  "confirm",
  "payment",
] as const;

export type BookingStepId = (typeof BOOKING_STEP_IDS)[number];

export const REACHABLE_STEP_IDS = [
  "details",
  "when",
  "addons",
  "confirm",
  "payment",
] as const satisfies readonly BookingStepId[];

export type ReachableStepId = (typeof REACHABLE_STEP_IDS)[number];

export interface BookingStepDefinition {
  readonly id: BookingStepId;
  readonly label: string;
  readonly heading: string;
  readonly reachable: boolean;
}

export const BOOKING_STEPS: readonly BookingStepDefinition[] = [
  {
    id: "details",
    label: "Details",
    heading: "Tell us about your visit",
    reachable: true,
  },
  {
    id: "when",
    label: "Date & time",
    heading: "When would you like to come?",
    reachable: true,
  },
  {
    id: "addons",
    label: "Add-ons",
    heading: "Would you like to add anything?",
    reachable: true,
  },
  {
    id: "confirm",
    label: "Confirm",
    heading: "Check your booking",
    reachable: true,
  },
  { id: "payment", label: "Payment", heading: "Payment", reachable: true },
];

export function stepIndex(id: BookingStepId): number {
  return BOOKING_STEPS.findIndex((step) => step.id === id);
}

export function isReachable(id: BookingStepId): id is ReachableStepId {
  return BOOKING_STEPS.find((step) => step.id === id)?.reachable ?? false;
}
