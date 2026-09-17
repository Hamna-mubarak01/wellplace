import { MESSAGE_TEXT_FONTS } from "@/lib/config/message-text";
import { messageTextAppearanceSchema } from "@/lib/validation/message-text";

export function messageTextStyle(raw: unknown) {
  const parsed = messageTextAppearanceSchema.safeParse(raw);
  if (!parsed.success) return {};
  const value = parsed.data;
  return {
    fontFamily: MESSAGE_TEXT_FONTS[value.font].value,
    fontSize: `${value.fontSize}px`,
    lineHeight: `${value.lineHeight}px`,
    color: value.color,
    backgroundColor: value.background,
    textAlign: value.align,
  };
}

export function messageTextCss(raw: unknown): string {
  return Object.entries(messageTextStyle(raw))
    .map(
      ([key, value]) =>
        `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value};`,
    )
    .join("");
}
