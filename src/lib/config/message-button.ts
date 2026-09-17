import type { MessageButtonAppearance } from "@/lib/domain/email/document";
import { EMAIL_THEME } from "@/lib/messaging/email-theme";

export const MESSAGE_BUTTON_LIMITS = {
  radius: { min: 0, max: 999 },
  padding: { min: 0, max: 80 },
} as const;

export const MESSAGE_BUTTON_DEFAULTS: MessageButtonAppearance = {
  followBrand: true,
  width: "auto",
  align: "left",
  background: EMAIL_THEME.brand,
  textColor: EMAIL_THEME.onBrand,
  radius: 6,
  paddingX: 28,
  paddingY: 14,
};
