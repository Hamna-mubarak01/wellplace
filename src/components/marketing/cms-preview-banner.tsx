import { Button } from "@/components/shared/button";
import { cmsPage } from "@/lib/config/cms/registry";
import { getCmsPreviewSlug } from "@/lib/services/cms-preview";

export async function CmsPreviewBanner() {
  const slug = await getCmsPreviewSlug();
  if (!slug) return null;
  return <aside aria-label="CMS draft preview" className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 border-t border-warning bg-warning-wash px-4 py-3 text-small text-warning-ink">
    <span>Draft preview: {cmsPage(slug)?.label}. Changes are not public.</span>
    <Button asChild size="sm" variant="outline" tone="brand"><a href={`/manage/cms/${slug}`}>Back to editor</a></Button>
    <Button asChild size="sm" variant="outline" tone="brand"><a href="/api/cms-preview?exit=1">Exit preview</a></Button>
  </aside>;
}
