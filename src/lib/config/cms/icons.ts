export const CONTENT_ICONS = [
  { value: "key", label: "Key" },
  { value: "lock", label: "Lock" },
  { value: "shield", label: "Shield" },
  { value: "clock", label: "Clock" },
  { value: "hourglass", label: "Hourglass" },
  { value: "calendar", label: "Calendar" },
  { value: "users", label: "Guests" },
  { value: "heart", label: "Heart" },
  { value: "sparkles", label: "Sparkles" },
  { value: "leaf", label: "Leaf" },
  { value: "flame", label: "Warmth" },
  { value: "droplet", label: "Water" },
  { value: "waves", label: "Waves" },
  { value: "sun", label: "Light" },
  { value: "moon", label: "Calm" },
  { value: "wind", label: "Air" },
  { value: "bath", label: "Whirlpool" },
  { value: "door", label: "Door" },
  { value: "home", label: "Suite" },
  { value: "map-pin", label: "Location" },
  { value: "phone", label: "Phone" },
  { value: "message", label: "Message" },
  { value: "star", label: "Star" },
  { value: "check", label: "Check" },
] as const;

export type ContentIconName = (typeof CONTENT_ICONS)[number]["value"];

export const DEFAULT_CONTENT_ICON: ContentIconName = "sparkles";

export function isContentIcon(value: string): value is ContentIconName {
  return CONTENT_ICONS.some((icon) => icon.value === value);
}
