import type { Metadata } from "next";
import { JetBrains_Mono, Newsreader, Public_Sans } from "next/font/google";

import "./globals.css";
import { NotFoundPage } from "@/components/marketing/not-found-page";
import { SITE_URL } from "@/lib/config/seo";
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

const THEME_SCRIPT = `try{var t=localStorage.getItem("wellplace-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Page not found — WellPlace",
  description: "The page you are looking for does not exist.",
  robots: { index: false, follow: true },
};

export default function GlobalNotFound() {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${publicSans.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <head>
        <SiteFavicon />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="density-editorial">
        <NotFoundPage />
      </body>
    </html>
  );
}
