export const SOCIAL_ICON_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X" },
  { value: "github", label: "GitHub" },
  { value: "youtube", label: "YouTube" },
  { value: "pinterest", label: "Pinterest" },
  { value: "telegram", label: "Telegram" },
  { value: "website", label: "Website / other profile" },
] as const;

export type SocialIconName = (typeof SOCIAL_ICON_OPTIONS)[number]["value"];

export const SOCIAL_ICON_ASSETS = {
  instagram: "/email/social/instagram.png",
  tiktok: "/email/social/tiktok.png",
  facebook: "/social/facebook.svg",
  linkedin: "/social/linkedin.svg",
  x: "/social/x.svg",
  github: "/social/github.svg",
  youtube: "/social/youtube.svg",
  pinterest: "/social/pinterest.svg",
  telegram: "/social/telegram.svg",
} as const;

export function resolveSocialIcon(value: string, href = ""): SocialIconName {
  const match = SOCIAL_ICON_OPTIONS.find((option) => option.value === value);
  if (match) return match.value;
  if (value) return "website";
  try {
    const host = new URL(href).hostname.toLowerCase();
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  } catch {}
  return "website";
}

export function socialIconLabel(icon: SocialIconName): string {
  return SOCIAL_ICON_OPTIONS.find((option) => option.value === icon)!.label;
}
