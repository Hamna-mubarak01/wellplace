import type { EmailFooterDesign, FooterIcon, FooterIconStyle } from "@/lib/domain/email/footer";

export const MESSAGE_FOOTER_LIMITS = { linksMax: 16, labelMax: 120, hrefMax: 2048 } as const;

export const FOOTER_PLATFORMS: readonly { value: FooterIcon; label: string; placeholder: string; colour: string }[] = [
  { value: "instagram", label: "Instagram", placeholder: "https://instagram.com/your-profile", colour: "rgb(228, 64, 95)" },
  { value: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@your-profile", colour: "rgb(17, 17, 17)" },
  { value: "facebook", label: "Facebook", placeholder: "https://facebook.com/your-page", colour: "rgb(8, 102, 255)" },
  { value: "x", label: "X (Twitter)", placeholder: "https://x.com/your-profile", colour: "rgb(17, 17, 17)" },
  { value: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/your-company", colour: "rgb(10, 102, 194)" },
  { value: "youtube", label: "YouTube", placeholder: "https://youtube.com/@your-channel", colour: "rgb(255, 0, 0)" },
  { value: "telegram", label: "Telegram", placeholder: "https://t.me/your-profile", colour: "rgb(0, 136, 204)" },
  { value: "pinterest", label: "Pinterest", placeholder: "https://pinterest.com/your-profile", colour: "rgb(189, 8, 28)" },
  { value: "github", label: "GitHub", placeholder: "https://github.com/your-profile", colour: "rgb(24, 23, 23)" },
  { value: "website", label: "Website", placeholder: "https://wellplace.example", colour: "rgb(143, 101, 41)" },
  { value: "email", label: "Email", placeholder: "mailto:hello@wellplace.example", colour: "rgb(143, 101, 41)" },
  { value: "phone", label: "Phone", placeholder: "tel:+971…", colour: "rgb(143, 101, 41)" },
  { value: "location", label: "Location", placeholder: "https://maps.google.com/…", colour: "rgb(143, 101, 41)" },
  { value: "link", label: "Custom link", placeholder: "https://…", colour: "rgb(143, 101, 41)" },
];

export const DEFAULT_FOOTER_DESIGN: EmailFooterDesign = {
  label: "", align: "center", iconStyle: "brand", divider: false, links: [],
};

export function footerIconPath(icon: FooterIcon, style: FooterIconStyle): string {
  return `/email/social/${icon}-${style}.png`;
}
