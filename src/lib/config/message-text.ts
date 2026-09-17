import type {
  AuthoredBlock,
  MessageTextAppearance,
} from "@/lib/domain/email/document";
import { EMAIL_FONTS, EMAIL_THEME } from "@/lib/messaging/email-theme";

export const MESSAGE_TEXT_LIMITS = {
  fontSize: { min: 10, max: 64 },
  lineHeight: { min: 12, max: 100 },
} as const;

export const MESSAGE_TEXT_FONTS = {
  body: { label: "Sans serif", value: EMAIL_FONTS.body },
  display: { label: "Serif", value: EMAIL_FONTS.display },
  mono: { label: "Monospace", value: EMAIL_FONTS.data },
} as const;

export const MESSAGE_TEXT_KINDS = [
  "text",
  "heading",
  "eyebrow",
  "lead",
  "note",
] as const;
export type StyledTextBlock = Extract<
  AuthoredBlock,
  { kind: (typeof MESSAGE_TEXT_KINDS)[number] }
>;

const defaults: MessageTextAppearance = {
  font: "body",
  fontSize: 16,
  lineHeight: 25,
  color: EMAIL_THEME.textPrimary,
  background: EMAIL_THEME.cardBackground,
  align: "left",
};
const sizes = {
  small: { fontSize: 15, lineHeight: 22 },
  normal: { fontSize: 16, lineHeight: 25 },
  large: { fontSize: 19, lineHeight: 28 },
} as const;

export function messageTextDefaults(
  block: StyledTextBlock,
): MessageTextAppearance {
  switch (block.kind) {
    case "heading":
      return { ...defaults, font: "display", fontSize: 30, lineHeight: 38 };
    case "eyebrow":
      return {
        ...defaults,
        fontSize: 12,
        lineHeight: 16,
        color: EMAIL_THEME.textMuted,
      };
    case "lead":
      return {
        ...defaults,
        fontSize: 19,
        lineHeight: 28,
        color: EMAIL_THEME.textSecondary,
      };
    case "note":
      return {
        ...defaults,
        fontSize: 13,
        lineHeight: 20,
        color: EMAIL_THEME.textMuted,
      };
    case "text":
      return {
        ...defaults,
        ...sizes[block.size],
        color: EMAIL_THEME.textSecondary,
        align: block.align,
      };
  }
}

export const MESSAGE_COLUMNS_LIMITS = { min: 2, max: 3 } as const;
