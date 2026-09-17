import type { Metadata } from "next";

import { safeImageSrc } from "@/lib/config/cms/links";
import { str } from "@/lib/config/cms/read";
import type { CmsPageValues } from "@/lib/config/cms/types";
import { OG_IMAGE, pageMetadata, type PageSeo } from "@/lib/config/seo";

export interface ResolvedSeo {
  readonly title: string;
  readonly description: string;
  readonly ogImage: string;
}

export function resolveSeo(values: CmsPageValues): ResolvedSeo {
  return {
    title: str(values, "seo", "title"),
    description: str(values, "seo", "description"),
    ogImage: str(values, "seo", "ogImage"),
  };
}

export function cmsPageMetadata(base: PageSeo, seo: ResolvedSeo): Metadata {
  const title = seo.title.trim() || base.title;
  const description = seo.description.trim() || base.description;
  const url = safeImageSrc(seo.ogImage, OG_IMAGE.url);
  const image =
    url && url !== OG_IMAGE.url
      ? { url, width: OG_IMAGE.width, height: OG_IMAGE.height, alt: title }
      : (base.image ?? OG_IMAGE);

  return pageMetadata({ ...base, title, description, image });
}
