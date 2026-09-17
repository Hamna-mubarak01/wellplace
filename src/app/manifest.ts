import type { MetadataRoute } from "next";

import { BROWSER_THEME } from "@/lib/config/browser-theme";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/config/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — private wellness suites in Dubai`,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: BROWSER_THEME.light,
    theme_color: BROWSER_THEME.light,
    lang: "en-AE",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
