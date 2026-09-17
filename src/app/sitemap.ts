import { publicPagePath } from "@/lib/services/site-content";
import type { MetadataRoute } from "next";

import { LAUNCH_MODE, OG_IMAGE, SITE_URL, absoluteUrl } from "@/lib/config/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const waitlist = {
    url: absoluteUrl("/waitlist"),
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 1,
  };

  const legal = {
    url: absoluteUrl("/legal"),
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.4,
  };

  if (LAUNCH_MODE !== "full") return [waitlist, legal];

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 1,
      images: [absoluteUrl(OG_IMAGE.url)],
    },
    {
      url: absoluteUrl("/book"),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: absoluteUrl(await publicPagePath("/contact")),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    ...await Promise.all(["/concept", "/suites", "/faq"].map(async (path) => ({
      url: absoluteUrl(await publicPagePath(path)), lastModified, changeFrequency: "monthly" as const, priority: 0.7,
    }))),
    { ...waitlist, priority: 0.8 },
    legal,
  ];
}
