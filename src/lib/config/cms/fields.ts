import type {
  CmsIconFieldSpec,
  CmsImageFieldSpec,
  CmsLeafFieldSpec,
  CmsLinesFieldSpec,
  CmsListFieldSpec,
  CmsMediaFieldSpec,
  CmsMediaItem,
  CmsRepeaterFieldSpec,
  CmsRepeaterItem,
  CmsSelectFieldSpec,
  CmsTextFieldSpec,
  CmsToggleFieldSpec,
} from "@/lib/config/cms/types";

export function text(
  key: string,
  label: string,
  defaultValue: string,
  help?: string,
): CmsTextFieldSpec {
  return { kind: "text", key, label, defaultValue, ...(help ? { help } : {}) };
}

export function paragraph(
  key: string,
  label: string,
  defaultValue: string,
  help?: string,
): CmsTextFieldSpec {
  return { kind: "textarea", key, label, defaultValue, ...(help ? { help } : {}) };
}

export function image(
  key: string,
  label: string,
  defaultValue: string,
  recommended?: string,
): CmsImageFieldSpec {
  return {
    kind: "image",
    key,
    label,
    defaultValue,
    ...(recommended ? { recommended } : {}),
  };
}

export function grouped<T extends CmsLeafFieldSpec>(group: string, field: T): T {
  return { ...field, group };
}

export function icon(
  key: string,
  label: string,
  defaultValue: string,
): CmsIconFieldSpec {
  return { kind: "icon", key, label, defaultValue };
}

export function choice(
  key: string,
  label: string,
  options: readonly { value: string; label: string }[],
  defaultValue: string,
  help?: string,
): CmsSelectFieldSpec {
  return {
    kind: "select",
    key,
    label,
    options,
    defaultValue,
    ...(help ? { help } : {}),
  };
}

export function toggle(
  key: string,
  label: string,
  defaultValue: boolean,
  labels?: { on: string; off: string },
  help?: string,
): CmsToggleFieldSpec {
  return {
    kind: "toggle",
    key,
    label,
    defaultValue,
    ...(labels ? { onLabel: labels.on, offLabel: labels.off } : {}),
    ...(help ? { help } : {}),
  };
}

export function textLines(
  key: string,
  label: string,
  itemLabel: string,
  maxItems: number,
  defaultValue: readonly string[],
  help?: string,
): CmsLinesFieldSpec {
  return {
    kind: "lines",
    key,
    label,
    itemLabel,
    maxItems,
    defaultValue: defaultValue.join("\n"),
    ...(help ? { help } : {}),
  };
}

export function media(
  key: string,
  label: string,
  urls: readonly string[],
  maxItems: number,
  help?: string,
): CmsMediaFieldSpec {
  const defaultValue: readonly CmsMediaItem[] = urls.map((url) => ({
    kind: "image" as const,
    url,
  }));
  return { kind: "media", key, label, maxItems, defaultValue, ...(help ? { help } : {}) };
}

export function list(
  key: string,
  label: string,
  itemLabel: string,
  maxItems: number,
  defaultValue: readonly string[],
  help?: string,
): CmsListFieldSpec {
  return {
    kind: "list",
    key,
    label,
    itemLabel,
    maxItems,
    defaultValue,
    ...(help ? { help } : {}),
  };
}

export function repeater(
  key: string,
  label: string,
  itemLabel: string,
  maxItems: number,
  fields: readonly CmsLeafFieldSpec[],
  defaultValue: readonly CmsRepeaterItem[],
  help?: string,
): CmsRepeaterFieldSpec {
  return {
    kind: "repeater",
    key,
    label,
    itemLabel,
    maxItems,
    fields,
    defaultValue,
    ...(help ? { help } : {}),
  };
}
