import type { MetadataRoute } from "next";

import { PRIVATE_CRAWLER_PATHS, SOCIAL_PREVIEW_CRAWLERS } from "@/lib/config/crawlers";
import { IS_PRODUCTION, SITE_URL } from "@/lib/config/seo";

export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION) {
    return {
      rules: [
        { userAgent: "*", disallow: "/" },
        {
          userAgent: SOCIAL_PREVIEW_CRAWLERS,
          allow: "/",
          disallow: PRIVATE_CRAWLER_PATHS,
        },
      ],
    };
  }

  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_CRAWLER_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
