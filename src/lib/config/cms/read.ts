import type {
  CmsMediaItem,
  CmsPageValues,
  CmsRepeaterItem,
} from "@/lib/config/cms/types";
import { splitLines } from "@/lib/config/cms/types";

export function str(values: CmsPageValues, section: string, key: string): string {
  const value = values[section]?.[key];
  return typeof value === "string" ? value : "";
}

export function strOr(
  values: CmsPageValues,
  section: string,
  key: string,
  fallback: string,
): string {
  return str(values, section, key).trim() || fallback;
}

export function bool(values: CmsPageValues, section: string, key: string): boolean {
  return values[section]?.[key] === true;
}

export function items(
  values: CmsPageValues,
  section: string,
  key: string,
): readonly CmsRepeaterItem[] {
  const value = values[section]?.[key];
  return Array.isArray(value) ? (value as readonly CmsRepeaterItem[]) : [];
}

export function strings(
  values: CmsPageValues,
  section: string,
  key: string,
): readonly string[] {
  const value = values[section]?.[key];
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? (value as readonly string[])
    : [];
}

export function mediaItems(
  values: CmsPageValues,
  section: string,
  key: string,
): readonly CmsMediaItem[] {
  const value = values[section]?.[key];
  return Array.isArray(value) ? (value as readonly CmsMediaItem[]) : [];
}

export function numberOr(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function itemStr(item: CmsRepeaterItem, key: string): string {
  const value = item[key];
  return typeof value === "string" ? value : "";
}

export function itemBool(
  item: CmsRepeaterItem,
  key: string,
  whenUnset: boolean,
): boolean {
  const value = item[key];
  return typeof value === "boolean" ? value : whenUnset;
}

export function itemLines(
  item: CmsRepeaterItem,
  key: string,
  maxItems: number,
): readonly string[] {
  return splitLines(itemStr(item, key), maxItems);
}
