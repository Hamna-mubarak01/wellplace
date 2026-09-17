import type { Metadata } from "next";

import { NotFoundPage } from "@/components/marketing/not-found-page";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you are looking for does not exist.",
  robots: { index: false, follow: true },
};

export default function SiteNotFound() {
  return <NotFoundPage />;
}
