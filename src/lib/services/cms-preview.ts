import { cache } from "react";
import { cookies, draftMode } from "next/headers";
import { readStaffSession } from "@/lib/auth/session";
import { CMS_PREVIEW_COOKIE } from "@/lib/config/cms/preview";
import { cmsPage } from "@/lib/config/cms/registry";
import { fetchCmsContent, fetchPublishedCmsContent, fetchPublishedCmsContentMany } from "@/lib/db/queries/cms";
import type { WellPlaceClient } from "@/lib/db/types";

export const getCmsPreviewSlug = cache(async (): Promise<string | null> => {
  if (!(await draftMode()).isEnabled) return null;
  const slug = (await cookies()).get(CMS_PREVIEW_COOKIE)?.value;
  if (!slug || !cmsPage(slug) || (await readStaffSession())?.role !== "management") return null;
  return slug;
});

export async function readSiteCms(client: WellPlaceClient, slug: string) {
  if (await getCmsPreviewSlug() === slug) return (await fetchCmsContent(client, slug))?.draft ?? null;
  return fetchPublishedCmsContent(client, slug);
}

export async function readSiteCmsMany(client: WellPlaceClient, slugs: readonly string[]) {
  const published = new Map(await fetchPublishedCmsContentMany(client, slugs));
  const preview = await getCmsPreviewSlug();
  if (preview && slugs.includes(preview)) published.set(preview, (await fetchCmsContent(client, preview))?.draft ?? {});
  return published;
}
