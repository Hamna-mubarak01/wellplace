import { withImageAltFields } from "@/lib/config/cms/alt-fields";
import { isContentIcon } from "@/lib/config/cms/icons";
import { resolveSocialIcon } from "@/lib/config/social-icons";
import type {
  CmsFieldSpec,
  CmsFieldValue,
  CmsLeafFieldSpec,
  CmsPageSpec,
  CmsPageValues,
  CmsMediaItem,
  CmsRepeaterItem,
  CmsRepeaterValue,
} from "@/lib/config/cms/types";

function isMediaItem(value: unknown): value is CmsMediaItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    (item.kind === "image" || item.kind === "video") && typeof item.url === "string"
  );
}

function toMediaItem(value: CmsMediaItem): CmsMediaItem {
  return { kind: value.kind, url: value.url };
}

function projectItem(
  fields: readonly CmsLeafFieldSpec[],
  item: CmsRepeaterItem,
): CmsRepeaterItem {
  const projected: Record<string, CmsRepeaterValue> = {};
  for (const field of fields) {
    const value = item[field.key];
    if (field.kind === "select" && field.iconSet === "social") {
      projected[field.key] = resolveSocialIcon(
        typeof value === "string" ? value : "",
        typeof item.href === "string" ? item.href : "",
      );
    } else if (value !== undefined) projected[field.key] = value;
  }
  return projected;
}

function isRepeaterItem(value: unknown): value is CmsRepeaterItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) => typeof entry === "string" || typeof entry === "boolean",
  );
}

export function coerceFieldValue(
  field: CmsFieldSpec,
  stored: unknown,
): CmsFieldValue | undefined {
  switch (field.kind) {
    case "text":
    case "textarea":
    case "lines":
    case "image":
      return typeof stored === "string" ? stored : undefined;
    case "toggle":
      return typeof stored === "boolean" ? stored : undefined;
    case "icon":
      return typeof stored === "string" && isContentIcon(stored) ? stored : undefined;
    case "select":
      return typeof stored === "string" &&
        field.options.some((option) => option.value === stored)
        ? stored
        : undefined;
    case "media":
      return Array.isArray(stored) && stored.every(isMediaItem)
        ? stored.slice(0, field.maxItems).map(toMediaItem)
        : undefined;
    case "list":
      return Array.isArray(stored) && stored.every((entry) => typeof entry === "string")
        ? (stored.slice(0, field.maxItems) as readonly string[])
        : undefined;
    case "repeater":
      return Array.isArray(stored) && stored.every(isRepeaterItem)
        ? stored
            .slice(0, field.maxItems)
            .map((item) => projectItem(field.fields, item))
        : undefined;
  }
}

export function resolveCmsValues(
  page: CmsPageSpec,
  stored: Record<string, unknown> | null | undefined,
): CmsPageValues {
  const resolved: Record<string, Record<string, CmsFieldValue>> = {};

  for (const section of withImageAltFields(page).sections) {
    const storedSection = stored?.[section.key];
    const sectionRecord =
      typeof storedSection === "object" && storedSection !== null && !Array.isArray(storedSection)
        ? (storedSection as Record<string, unknown>)
        : undefined;

    const values: Record<string, CmsFieldValue> = {};
    for (const field of section.fields) {
      const candidate =
        sectionRecord === undefined
          ? undefined
          : coerceFieldValue(field, sectionRecord[field.key]);
      values[field.key] = candidate ?? field.defaultValue;
    }
    resolved[section.key] = values;
  }

  return resolved;
}

function sameValue(a: CmsFieldValue, b: CmsFieldValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function pruneCmsValues(
  page: CmsPageSpec,
  values: CmsPageValues,
): Record<string, Record<string, CmsFieldValue>> {
  const pruned: Record<string, Record<string, CmsFieldValue>> = {};

  for (const section of withImageAltFields(page).sections) {
    const sectionValues = values[section.key];
    if (!sectionValues) continue;

    const overrides: Record<string, CmsFieldValue> = {};
    for (const field of section.fields) {
      const value = sectionValues[field.key];
      if (value === undefined) continue;
      if (sameValue(value, field.defaultValue)) continue;
      overrides[field.key] = value;
    }

    if (Object.keys(overrides).length > 0) {
      pruned[section.key] = overrides;
    }
  }

  return pruned;
}

export function isSectionCustomised(
  page: CmsPageSpec,
  values: CmsPageValues,
  sectionKey: string,
): boolean {
  const section = page.sections.find((entry) => entry.key === sectionKey);
  const sectionValues = values[sectionKey];
  if (!section || !sectionValues) return false;

  return section.fields.some((field) => {
    const value = sectionValues[field.key];
    return value !== undefined && !sameValue(value, field.defaultValue);
  });
}
