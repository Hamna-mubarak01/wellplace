import { Newsreader, Public_Sans, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SiteFavicon } from "@/components/shared/site-favicon";
const heading = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});
const body = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});
const data = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});
const THEME_SCRIPT = `try{var t=localStorage.getItem("wellplace-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;
export default function ReceiptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${heading.variable} ${body.variable} ${data.variable} antialiased`}
    >
      <head>
        <SiteFavicon />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="density-editorial bg-surface-base text-text-primary">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
