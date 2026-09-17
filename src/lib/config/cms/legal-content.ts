import { LEGAL_CMS_PAGE } from "@/lib/config/cms/pages/legal";
import { resolveCmsValues } from "@/lib/config/cms/values";
import { strOr, str } from "@/lib/config/cms/read";
import { LEGAL_DOCUMENTS, LEGAL_TEXTS_VERSION } from "@/lib/config/legal";

export function resolveLegalContent(stored: Record<string, unknown> | null) {
  const values = resolveCmsValues(LEGAL_CMS_PAGE, stored);
  return {
    version: strOr(values, "publication", "version", LEGAL_TEXTS_VERSION),
    documents: LEGAL_DOCUMENTS.map((document) => ({ ...document,
      title: strOr(values, document.slug, "title", document.title),
      lastUpdated: str(values, document.slug, "lastUpdated") || document.lastUpdated,
      paragraphs: strOr(values, document.slug, "body", document.paragraphs.join("\n\n")).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    })),
  };
}
