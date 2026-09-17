import type { Metadata } from "next";
import { Cormorant_Garamond, JetBrains_Mono, Newsreader, Public_Sans } from "next/font/google";
import "../globals.css";
import type { Viewport } from "next";

import {
  DEFAULT_DESCRIPTION,
  GOOGLE_SITE_VERIFICATION,
  LOCALE,
  OG_IMAGE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/config/seo";
import { BROWSER_THEME } from "@/lib/config/browser-theme";
import { StructuredData } from "@/components/marketing/structured-data";
import { SiteStartupLoader } from "@/components/marketing/site-startup-loader";
import { TagManager } from "@/components/marketing/tag-manager";
import { Toaster } from "@/components/ui/sonner";
import { SiteFavicon } from "@/components/shared/site-favicon";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant-garamond",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — private wellness suites in Dubai`, template: `%s · ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: LOCALE,
    url: "/",
    title: `${SITE_NAME} — private wellness suites in Dubai`,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — private wellness suites in Dubai`,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  formatDetection: { telephone: false, address: false, email: false },
  referrer: "strict-origin-when-cross-origin",
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "wellness",
  verification: GOOGLE_SITE_VERIFICATION
    ? { google: GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BROWSER_THEME.light },
    { media: "(prefers-color-scheme: dark)", color: BROWSER_THEME.dark },
  ],
  colorScheme: "light dark",
};

const THEME_SCRIPT = `try{var t=localStorage.getItem("wellplace-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

export default function SiteRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${publicSans.variable} ${jetBrainsMono.variable} ${cormorantGaramond.variable} h-full antialiased`}
    >
      <head>
        <SiteFavicon />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <StructuredData />
        <TagManager />
      </head>
      <body className="density-editorial flex min-h-full flex-col">
        {children}
        <SiteStartupLoader />
        <Toaster richColors />
      </body>
    </html>
  );
}
