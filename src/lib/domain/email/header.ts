export const HEADER_LOGOS = ["wordmark", "custom", "none"] as const;

export type HeaderLogo = (typeof HEADER_LOGOS)[number];

export interface EmailHeaderDesign {
  readonly logo: HeaderLogo;
  readonly logoSrc: string;
  readonly logoAlt: string;
  readonly logoWidth: number;
  readonly text: string;
  readonly align: "left" | "center" | "right";
}

export function isHeaderImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
