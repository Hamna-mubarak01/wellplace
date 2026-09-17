import { withImageAltFields } from "@/lib/config/cms/alt-fields";
export type CmsFieldKind =
  | "text"
  | "textarea"
  | "lines"
  | "image"
  | "select"
  | "toggle"
  | "icon"
  | "media"
  | "list"
  | "repeater";

export interface CmsFieldBase {
  readonly key: string;
  readonly label: string;
  readonly help?: string;
  readonly group?: string;
  readonly required?: boolean;
}

export interface CmsTextFieldSpec extends CmsFieldBase {
  readonly kind: "text" | "textarea";
  readonly placeholder?: string;
  readonly maxLength?: number;
  readonly defaultValue: string;
}

export interface CmsLinesFieldSpec extends CmsFieldBase {
  readonly kind: "lines";
  readonly itemLabel: string;
  readonly maxItems: number;
  readonly defaultValue: string;
}

export interface CmsImageFieldSpec extends CmsFieldBase {
  readonly kind: "image";
  readonly previewFit?: "cover" | "contain";
  readonly faviconOnly?: boolean;
  readonly recommended?: string;
  readonly defaultValue: string;
}

export interface CmsMediaFieldSpec extends CmsFieldBase {
  readonly kind: "media";
  readonly maxItems: number;
  readonly defaultValue: readonly CmsMediaItem[];
}

export interface CmsListFieldSpec extends CmsFieldBase {
  readonly kind: "list";
  readonly itemLabel: string;
  readonly maxItems: number;
  readonly defaultValue: readonly string[];
}

export interface CmsIconFieldSpec extends CmsFieldBase {
  readonly kind: "icon";
  readonly defaultValue: string;
}

export interface CmsSelectFieldSpec extends CmsFieldBase {
  readonly kind: "select";
  readonly iconSet?: "social";
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly defaultValue: string;
}

export interface CmsToggleFieldSpec extends CmsFieldBase {
  readonly kind: "toggle";
  readonly onLabel?: string;
  readonly offLabel?: string;
  readonly defaultValue: boolean;
}

export type CmsLeafFieldSpec =
  | CmsTextFieldSpec
  | CmsLinesFieldSpec
  | CmsImageFieldSpec
  | CmsSelectFieldSpec
  | CmsToggleFieldSpec
  | CmsIconFieldSpec;

export interface CmsRepeaterFieldSpec extends CmsFieldBase {
  readonly kind: "repeater";
  readonly itemLabel: string;
  readonly maxItems: number;
  readonly fields: readonly CmsLeafFieldSpec[];
  readonly defaultValue: readonly CmsRepeaterItem[];
}

export type CmsFieldSpec =
  | CmsTextFieldSpec
  | CmsLinesFieldSpec
  | CmsImageFieldSpec
  | CmsSelectFieldSpec
  | CmsToggleFieldSpec
  | CmsIconFieldSpec
  | CmsMediaFieldSpec
  | CmsListFieldSpec
  | CmsRepeaterFieldSpec;

export type CmsMediaKind = "image" | "video";

export interface CmsMediaItem {
  readonly kind: CmsMediaKind;
  readonly url: string;
}

export type CmsRepeaterValue = string | boolean;
export type CmsRepeaterItem = Readonly<Record<string, CmsRepeaterValue>>;

export type CmsFieldValue =
  | string
  | boolean
  | readonly string[]
  | readonly CmsMediaItem[]
  | readonly CmsRepeaterItem[];

export type CmsSectionValues = Readonly<Record<string, CmsFieldValue>>;
export type CmsPageValues = Readonly<Record<string, CmsSectionValues>>;

export interface CmsSectionSpec {
  readonly key: string;
  readonly label: string;
  readonly icon: CmsIconName;
  readonly title: string;
  readonly description: string;
  readonly fields: readonly CmsFieldSpec[];
}

export type CmsPageGroup = "Pages" | "Shared";

export interface CmsPageSpec {
  readonly slug: string;
  readonly label: string;
  readonly description: string;
  readonly icon: CmsIconName;
  readonly group: CmsPageGroup;
  readonly route: string | null;
  readonly revalidateRoutes?: readonly string[];
  readonly editableNote?: string;
  readonly sections: readonly CmsSectionSpec[];
}

export const CMS_PAGE_GROUPS: readonly CmsPageGroup[] = ["Pages", "Shared"];

export const CMS_ICON_NAMES = [
  "home",
  "sparkles",
  "layers",
  "calendar",
  "message",
  "megaphone",
  "phone",
  "search",
  "settings",
  "scale",
  "image",
  "list",
  "map",
  "share",
  "clock",
  "users",
] as const;

export type CmsIconName = (typeof CMS_ICON_NAMES)[number];

export function defaultValuesFor(page: CmsPageSpec): CmsPageValues {
  const values: Record<string, Record<string, CmsFieldValue>> = {};
  for (const section of withImageAltFields(page).sections) {
    const sectionValues: Record<string, CmsFieldValue> = {};
    for (const field of section.fields) {
      sectionValues[field.key] = field.defaultValue;
    }
    values[section.key] = sectionValues;
  }
  return values;
}

export function fieldSpec(
  page: CmsPageSpec,
  sectionKey: string,
  fieldKey: string,
): CmsFieldSpec | undefined {
  return page.sections
    .find((section) => section.key === sectionKey)
    ?.fields.find((field) => field.key === fieldKey);
}

export function splitLines(value: string, maxItems: number): readonly string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, maxItems);
}
