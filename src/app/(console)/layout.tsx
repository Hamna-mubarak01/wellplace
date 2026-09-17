import type { Metadata } from "next";
import { JetBrains_Mono, Newsreader, Public_Sans } from "next/font/google";
import "../globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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

export const metadata: Metadata = {
  title: { default: "WellPlace Console", template: "%s · WellPlace Console" },
  robots: { index: false, follow: false },
};

const THEME_SCRIPT = `try{var t=localStorage.getItem("wellplace-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

export default function ConsoleRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      <body className="density-console flex min-h-full flex-col">
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
