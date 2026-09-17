import { resolveNavbarContent } from "@/lib/config/cms/site-chrome-content";
import { fetchPublishedCmsContent } from "@/lib/db/queries/cms";
import { createClient } from "@/lib/db/server";
import { SITE_ICON } from "@/lib/config/site-icon";

export async function publishedSiteIcon(fallback: string = SITE_ICON.fallback): Promise<string> {
  let location = fallback;
  try {
    const published = await fetchPublishedCmsContent(await createClient(), "navbar");
    const { favicon } = resolveNavbarContent(published);
    if (favicon && !["/icon", "/favicon.ico", SITE_ICON.endpoint].includes(favicon.split(/[?#]/)[0])) {
      location = favicon;
    }
  } catch (cause) {
    console.error("[cms] favicon unavailable, using original icon:", cause instanceof Error ? cause.message : "Unknown failure");
  }
  return location;
}

export async function siteIconResponse(fallback: string): Promise<Response> {
  const location = await publishedSiteIcon(fallback);
  return new Response(null, {
    status: 307,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}
