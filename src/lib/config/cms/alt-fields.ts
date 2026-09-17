import type { CmsFieldSpec, CmsLeafFieldSpec, CmsPageSpec } from "@/lib/config/cms/types";

// [§CMS functions] Authored descriptions accompany every
// content image. Empty descriptions retain the rendering's built-in description.
export function withImageAltFields(page: CmsPageSpec): CmsPageSpec {
  function leaves(fields: readonly CmsLeafFieldSpec[]): readonly CmsLeafFieldSpec[] {
    return fields.flatMap((field): CmsLeafFieldSpec[] => field.kind === "image" && !field.faviconOnly && !["ogImage", "staticImage", "logo"].includes(field.key) && !fields.some((other) => other.key === `${field.key}Alt`)
      ? [field, { kind: "text", key: `${field.key}Alt`, label: `${field.label} — alt text`, defaultValue: "", group: field.group,
        help: "Describe what this image shows. Leave empty to use the built-in description." }]
      : [field]);
  }
  return { ...page, sections: page.sections.map((section) => ({ ...section,
    fields: section.key === "bridge" || (page.slug === "book" && section.key === "hero") ? section.fields : section.fields.flatMap((field): CmsFieldSpec[] => field.kind === "repeater"
      ? [{ ...field, fields: leaves(field.fields) }]
      : field.kind === "media" || field.kind === "list" || section.fields.some((other) => other.key === `${field.key}Alt`) ? [field] : [...leaves([field])]),
  })) };
}
