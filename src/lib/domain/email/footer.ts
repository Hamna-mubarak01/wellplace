export const FOOTER_ICONS = [
  "instagram", "tiktok", "facebook", "x", "linkedin", "youtube", "whatsapp",
  "telegram", "pinterest", "github", "website", "email", "phone", "location", "link",
] as const;

export type FooterIcon = (typeof FOOTER_ICONS)[number];
export type FooterIconStyle = "brand" | "coloured" | "monochrome";

export interface EmailFooterLink {
  readonly id: string;
  readonly icon: FooterIcon;
  readonly label: string;
  readonly href: string;
  readonly enabled: boolean;
}

export interface EmailFooterDesign {
  readonly label: string;
  readonly align: "left" | "center" | "right";
  readonly iconStyle: FooterIconStyle;
  readonly divider: boolean;
  readonly links: readonly EmailFooterLink[];
}

export function isFooterHref(value: string): boolean {
  if (/[\u0000-\u0020\u007f]/.test(value)) return false;
  if (/^mailto:[^@?]+@[^@?]+\.[^@?]+$/i.test(value)) return true;
  if (/^tel:\+?[\d().-]+$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
