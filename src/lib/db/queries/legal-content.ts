import { resolveLegalContent } from "@/lib/config/cms/legal-content";
import { fetchPublishedCmsContent } from "@/lib/db/queries/cms";
import type { WellPlaceClient } from "@/lib/db/types";

export async function publishedLegalVersion(client: WellPlaceClient): Promise<string> {
  return resolveLegalContent(await fetchPublishedCmsContent(client, "legal")).version;
}
