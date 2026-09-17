import { MANAGEMENT_LIST } from "@/lib/config/management-lists";

export interface PageRequest {
  readonly page: number;
  readonly pageSize?: number;
}

export interface PageWindow {
  readonly page: number;
  readonly pageSize: number;
  readonly from: number;
  readonly to: number;
}

export type Paged<T> =
  | { ok: true; rows: T[]; total: number; page: number; pageSize: number }
  | { ok: false; message: string };

export const RANGE_NOT_SATISFIABLE = "PGRST103";

export function pageWindow(request: PageRequest): PageWindow {
  const requested = Number.isFinite(request.pageSize) ? Math.trunc(request.pageSize ?? MANAGEMENT_LIST.pageSize) : MANAGEMENT_LIST.pageSize;
  const pageSize = Math.min(Math.max(1, requested), MANAGEMENT_LIST.maxPageSize);
  const page = Number.isFinite(request.page) ? Math.max(1, Math.trunc(request.page)) : 1;
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

export function regexSearchTerm(term: string | undefined): string | null {
  const trimmed = term?.trim() ?? "";
  if (trimmed.length === 0) return null;
  return JSON.stringify(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

export function orSearch(columns: readonly string[], term: string | undefined): string | null {
  const escaped = regexSearchTerm(term);
  if (escaped === null) return null;
  return columns.map((column) => `${column}.imatch.${escaped}`).join(",");
}
