
export const EMAIL_THEME = {
  pageBackground: "#f0e9de",
  cardBackground: "#fbf6ee",
  panelBackground: "#f7f2ea",

  border: "#d8ccb9",
  borderStrong: "#b9aa92",

  textPrimary: "#2a2118",
  textSecondary: "#5c5042",
  textMuted: "#8b7e6c",

  brand: "#8f6529",
  brandHover: "#74501e",
  brandWash: "#e9dcc5",
  onBrand: "#fbf6ee",

  success: "#2f6b4f",
} as const;

export const EMAIL_THEME_TOKEN_SOURCE: Readonly<
  Record<keyof typeof EMAIL_THEME, string>
> = {
  pageBackground: "--onsen-sand-200",
  cardBackground: "--onsen-sand-50",
  panelBackground: "--onsen-sand-100",
  border: "--onsen-sand-500",
  borderStrong: "--onsen-sand-600",
  textPrimary: "--onsen-sand-900",
  textSecondary: "--onsen-sand-800",
  textMuted: "--onsen-sand-700",
  brand: "--onsen-brass-700",
  brandHover: "--onsen-brass-800",
  brandWash: "--onsen-sand-300",
  onBrand: "--onsen-sand-50",
  success: "--onsen-pine-600",
};

export const EMAIL_FONTS = {
  display: "Georgia, 'Times New Roman', Times, serif",
  body:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  data: "'SF Mono', SFMono-Regular, Menlo, Consolas, 'Courier New', monospace",
} as const;
