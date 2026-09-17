import { paragraph, text } from "@/lib/config/cms/fields";
import { LEGAL_DOCUMENTS, LEGAL_TEXTS_VERSION } from "@/lib/config/legal";
import type { CmsPageSpec } from "@/lib/config/cms/types";

// [§CMS functions] Originals remain unchanged; published
// overrides and each revision are retained by the existing CMS publication RPC.
export const LEGAL_CMS_PAGE: CmsPageSpec = {
  slug: "legal", label: "Legal documents", description: "Legal Terms, Privacy Policy, Marketing Terms and Cookie Policy.",
  icon: "scale", group: "Pages", route: "/legal", revalidateRoutes: ["/waitlist", "/book"],
  editableNote: "Use client-approved legal wording. Change the document version when changing wording, then save, preview and publish.",
  sections: [
    { key: "publication", label: "Version", icon: "scale", title: "Document version", description: "Recorded with new consent acceptances. Existing acceptance records keep their original version.", fields: [
      { ...text("version", "Document version", LEGAL_TEXTS_VERSION), required: true, maxLength: 60 },
    ] },
    ...LEGAL_DOCUMENTS.map((document) => ({
      key: document.slug, label: document.title, icon: "scale" as const, title: document.title,
      description: "Separate paragraphs with a blank line. Links in existing legal wording remain available.",
      fields: [text("title", "Title", document.title), text("lastUpdated", "Last updated", document.lastUpdated ?? ""),
        { ...paragraph("body", "Document text", document.paragraphs.join("\n\n")), required: true }],
    })),
  ],
};
