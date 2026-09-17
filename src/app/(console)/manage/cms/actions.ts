"use server";

import { resolvePublicUrls } from "@/lib/config/cms/public-urls";
import { resolveLegalContent } from "@/lib/config/cms/legal-content";
import { fetchCmsContent } from "@/lib/db/queries/cms";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManagement } from "@/lib/auth/session";
import { CMS_LIMITS } from "@/lib/config/cms/limits";
import { cmsValuesError } from "@/lib/validation/cms-values";
import { cmsPage } from "@/lib/config/cms/registry";
import { pruneCmsValues } from "@/lib/config/cms/values";
import type { CmsPageSpec, CmsPageValues } from "@/lib/config/cms/types";
import { createClient } from "@/lib/db/server";
import { uploadCmsMedia } from "@/lib/services/cms-media-service";
import {
  publishCmsPage,
  resetCmsPage,
  saveCmsDraft,
} from "@/lib/db/rpc";
import type { Json } from "@/types/database.generated";

export type CmsActionResult = { ok: true } | { ok: false; message: string };

const slugSchema = z.string().trim().min(1).max(64);
const labelSchema = z.string().trim().max(60).optional();
const RESET_REASON = "Reset to the built-in content";

const mediaItemSchema = z.object({
  kind: z.enum(["image", "video"]),
  url: z.string().trim().max(CMS_LIMITS.listItem),
});

const repeaterItemSchema = z.record(
  z.string().max(64),
  z.union([z.string().max(CMS_LIMITS.text), z.boolean()]),
);

const fieldValueSchema = z.union([
  z.string().max(CMS_LIMITS.text),
  z.boolean(),
  z.array(z.string().max(CMS_LIMITS.listItem)).max(CMS_LIMITS.mediaItems),
  z.array(mediaItemSchema).max(CMS_LIMITS.mediaItems),
  z.array(repeaterItemSchema).max(CMS_LIMITS.repeaterItems),
]);

const valuesSchema = z.record(
  z.string().max(64),
  z.record(z.string().max(64), fieldValueSchema),
);

function explain(message: string): string {
  if (message.includes("Management role required")) {
    return "You do not have permission to change website content.";
  }
  if (message.includes("Nothing to publish")) {
    return "Save your changes before publishing.";
  }
  return "That change could not be saved. Please try again.";
}

function revalidate(page: CmsPageSpec) {
  revalidatePath("/manage/cms");
  revalidatePath(`/manage/cms/${page.slug}`);
  for (const route of [page.route, ...(page.revalidateRoutes ?? [])]) {
    if (route) revalidatePath(route);
  }
}

export async function saveCmsPageDraft(
  rawSlug: unknown,
  rawValues: unknown,
): Promise<CmsActionResult> {
  await requireManagement();

  const slug = slugSchema.safeParse(rawSlug);
  const values = valuesSchema.safeParse(rawValues);
  if (!slug.success || !values.success) {
    return { ok: false, message: "Some content is too long or contains an unsupported value. Shorten the text or remove extra items before saving." };
  }

  const page = cmsPage(slug.data);
  if (!page) return { ok: false, message: "That page is not managed by the CMS." };

  const fieldError = cmsValuesError(page, values.data as CmsPageValues);
  if (fieldError) return { ok: false, message: fieldError };

  if (page.slug === "urls") {
    const rules = resolvePublicUrls(values.data);
    if (rules.error) return { ok: false, message: rules.error };
  }
  const overrides = pruneCmsValues(page, values.data as CmsPageValues);
  if (page.slug === "faq") overrides.homePreview = values.data.homePreview ?? {};

  const client = await createClient();
  const result = await saveCmsDraft(client, page.slug, overrides as Json);
  if (result.outcome === "failed") {
    return { ok: false, message: explain(result.message) };
  }

  revalidate(page);
  return { ok: true };
}

export async function publishCmsPageAction(
  rawSlug: unknown,
  rawLabel: unknown,
): Promise<CmsActionResult> {
  await requireManagement();

  const slug = slugSchema.safeParse(rawSlug);
  const label = labelSchema.safeParse(
    typeof rawLabel === "string" && rawLabel.trim() ? rawLabel : undefined,
  );
  if (!slug.success || !label.success) {
    return { ok: false, message: "That publish request was not valid." };
  }

  const page = cmsPage(slug.data);
  if (!page) return { ok: false, message: "That page is not managed by the CMS." };

  const client = await createClient();
  if (page.slug === "legal") {
    const record = await fetchCmsContent(client, page.slug);
    if (record) {
      const before = resolveLegalContent(record.published);
      const after = resolveLegalContent(record.draft);
      if (JSON.stringify(before.documents) !== JSON.stringify(after.documents) && before.version === after.version)
        return { ok: false, message: "Change the document version before publishing new legal wording." };
    }
  }
  const result = await publishCmsPage(client, page.slug, label.data ?? null);
  if (result.outcome === "failed") {
    return { ok: false, message: explain(result.message) };
  }

  revalidate(page);
  return { ok: true };
}

export async function resetCmsPageAction(rawSlug: unknown): Promise<CmsActionResult> {
  await requireManagement();

  const slug = slugSchema.safeParse(rawSlug);
  if (!slug.success) {
    return { ok: false, message: "That page could not be reset." };
  }

  const page = cmsPage(slug.data);
  if (!page) return { ok: false, message: "That page is not managed by the CMS." };

  const client = await createClient();
  const result = await resetCmsPage(client, page.slug, RESET_REASON);
  if (result.outcome === "failed") {
    return { ok: false, message: explain(result.message) };
  }

  if (page.slug === "faq") {
    const ownership = await saveCmsDraft(client, page.slug, { homePreview: {} });
    if (ownership.outcome === "failed") return { ok: false, message: explain(ownership.message) };
  }

  revalidate(page);
  return { ok: true };
}

export type CmsUploadActionResult =
  | { ok: true; url: string; kind: "image" | "video" }
  | { ok: false; message: string };

export async function uploadCmsMediaAction(
  formData: FormData,
): Promise<CmsUploadActionResult> {
  await requireManagement();

  const slug = slugSchema.safeParse(formData.get("slug"));
  if (!slug.success) {
    return { ok: false, message: "That upload was not addressed to a page." };
  }

  const page = cmsPage(slug.data);
  if (!page) return { ok: false, message: "That page is not managed by the CMS." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }

  const client = await createClient();
  return uploadCmsMedia(client, page.slug, file);
}
