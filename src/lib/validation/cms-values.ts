import { CMS_LIMITS } from "@/lib/config/cms/limits";
import { coerceFieldValue } from "@/lib/config/cms/values";
import type { CmsFieldSpec, CmsPageSpec, CmsPageValues } from "@/lib/config/cms/types";

export function cmsFieldError(field: CmsFieldSpec, value: unknown): string | undefined {
  if (value === undefined) return;
  if (coerceFieldValue(field, value) === undefined) return `Choose a valid value for ${field.label.toLowerCase()}.`;
  if (typeof value === "string") {
    const maximum = field.kind === "text" || field.kind === "textarea" ? field.maxLength ?? CMS_LIMITS.text : CMS_LIMITS.text;
    if (value.length > maximum) return `Keep ${field.label.toLowerCase()} to ${maximum} characters or fewer.`;
    if (field.kind === "lines" && value.split("\n").filter((line) => line.trim()).length > field.maxItems) return `${field.label} allows up to ${field.maxItems} lines. Remove the extra lines before saving.`;
  }
  if (Array.isArray(value) && "maxItems" in field) {
    if (value.length > field.maxItems) return `${field.label} allows up to ${field.maxItems} items. Remove the extra items before saving.`;
    if (field.kind === "list" && value.some((item) => item.length > CMS_LIMITS.listItem)) return `Keep each ${field.itemLabel.toLowerCase()} to ${CMS_LIMITS.listItem} characters or fewer.`;
    if (field.kind === "repeater") {
      for (const [index, item] of value.entries()) for (const leaf of field.fields) {
        const error = cmsFieldError(leaf, item[leaf.key]);
        if (error) return `${field.label}, item ${index + 1}: ${error}`;
      }
    }
  }
}
export function cmsValuesError(page: CmsPageSpec, values: CmsPageValues): string | undefined {
  for (const section of page.sections) for (const field of section.fields) {
    const error = cmsFieldError(field, values[section.key]?.[field.key]);
    if (error) return `${section.label}: ${error}`;
  }
}
