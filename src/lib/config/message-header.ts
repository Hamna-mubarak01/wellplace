import type { EmailHeaderDesign } from "@/lib/domain/email/header";

export const MESSAGE_HEADER_LIMITS = {
  textMax: 200,
  altMax: 120,
  hrefMax: 2048,
  logoWidthMin: 60,
  logoWidthMax: 320,
} as const;

export const EMAIL_WORDMARK_SIZE = { width: 168, height: 33 } as const;

export const DEFAULT_HEADER_DESIGN: EmailHeaderDesign = {
  logo: "wordmark",
  logoSrc: "",
  logoAlt: "",
  logoWidth: EMAIL_WORDMARK_SIZE.width,
  text: "",
  align: "center",
};
