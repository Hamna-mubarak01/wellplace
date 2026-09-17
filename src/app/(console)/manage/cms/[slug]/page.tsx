import { withLegacyHomeFaq } from "@/lib/config/cms/faq-content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CmsEditor } from "@/components/console/cms/cms-editor";
import { requireManagement } from "@/lib/auth/session";
import { cmsPage } from "@/lib/config/cms/registry";
import { resolveCmsValues } from "@/lib/config/cms/values";
import { fetchCmsContent } from "@/lib/db/queries/cms";
import { createClient } from "@/lib/db/server";

export const metadata: Metadata = {
  title: "Edit content",
  robots: { index: false, follow: false },
};

export default async function CmsPageEditor({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireManagement();

  const { slug } = await params;
  const page = cmsPage(slug);
  if (!page) notFound();

  const supabase = await createClient();
  const [record, legacy] = await Promise.all([
    fetchCmsContent(supabase, page.slug),
    slug === "faq" ? fetchCmsContent(supabase, "home") : Promise.resolve(null),
  ]);
  const draft = slug === "faq" ? withLegacyHomeFaq(record?.draft, legacy?.published) : record?.draft;
  const published = slug === "faq" ? withLegacyHomeFaq(record?.published, legacy?.published) : record?.published;
  const values = resolveCmsValues(page, draft);
  const publishedValues = resolveCmsValues(page, published);
  const hasUnpublishedChanges =
    record !== null &&
    JSON.stringify(record.draft) !== JSON.stringify(record.published ?? {});

  return (
    <div className="mx-auto flex w-full max-w-console flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <CmsEditor
        page={page}
        initialValues={values}
        publishedValues={publishedValues}
        status={record?.status ?? "draft"}
        hasUnpublishedChanges={hasUnpublishedChanges}
      />
    </div>
  );
}
