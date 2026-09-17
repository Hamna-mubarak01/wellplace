import { z } from "zod";

import type { WellPlaceClient } from "@/lib/db/types";

const contentRowSchema = z.object({
  slug: z.string(),
  status: z.enum(["draft", "published"]),
  draft_data: z.unknown(),
  published_data: z.unknown().nullable(),
  updated_at: z.string(),
  published_at: z.string().nullable(),
});

export interface CmsContentRecord {
  slug: string;
  status: "draft" | "published";
  draft: Record<string, unknown>;
  published: Record<string, unknown> | null;
  updatedAt: string;
  publishedAt: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function fetchCmsContent(
  client: WellPlaceClient,
  slug: string,
): Promise<CmsContentRecord | null> {
  const { data, error } = await client
    .from("cms_content")
    .select("slug, status, draft_data, published_data, updated_at, published_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Could not read CMS content: ${error.message}`);
  if (!data) return null;

  const row = contentRowSchema.parse(data);
  return {
    slug: row.slug,
    status: row.status,
    draft: asRecord(row.draft_data),
    published: row.published_data === null ? null : asRecord(row.published_data),
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export async function fetchAllCmsContent(
  client: WellPlaceClient,
): Promise<readonly CmsContentRecord[]> {
  const { data, error } = await client
    .from("cms_content")
    .select("slug, status, draft_data, published_data, updated_at, published_at");

  if (error) throw new Error(`Could not read CMS content: ${error.message}`);

  return (data ?? []).map((entry) => {
    const row = contentRowSchema.parse(entry);
    return {
      slug: row.slug,
      status: row.status,
      draft: asRecord(row.draft_data),
      published: row.published_data === null ? null : asRecord(row.published_data),
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
    };
  });
}

export async function fetchPublishedCmsContentMany(
  client: WellPlaceClient,
  slugs: readonly string[],
): Promise<ReadonlyMap<string, Record<string, unknown>>> {
  if (slugs.length === 0) return new Map();

  const { data, error } = await client
    .from("cms_published_content")
    .select("slug, published_data")
    .in("slug", [...slugs]);

  if (error) throw new Error(`Could not read published content: ${error.message}`);

  const rows = z
    .array(z.object({ slug: z.string(), published_data: z.unknown() }))
    .parse(data ?? []);

  return new Map(rows.map((row) => [row.slug, asRecord(row.published_data)]));
}

export async function fetchPublishedCmsContent(
  client: WellPlaceClient,
  slug: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client
    .from("cms_published_content")
    .select("published_data")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Could not read published content: ${error.message}`);
  if (!data) return null;

  return asRecord((data as { published_data: unknown }).published_data);
}
