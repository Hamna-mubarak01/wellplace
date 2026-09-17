import { permanentRedirect } from "next/navigation";

import { LEGAL_INDEX_HREF, findLegalDocument, legalHref } from "@/lib/config/legal";

interface LegalDocumentPageProps {
  params: Promise<{ document: string }>;
}

export default async function LegalDocumentPage({ params }: LegalDocumentPageProps) {
  const { document: slug } = await params;
  const entry = findLegalDocument(slug);

  permanentRedirect(entry ? legalHref(entry.slug) : LEGAL_INDEX_HREF);
}
