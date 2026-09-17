export const DESK_PANELS = ["arrivals", "alerts", "notes", "tasks"] as const;
export type DeskPanel = (typeof DESK_PANELS)[number];
export type DeskItems = Record<DeskPanel, readonly string[] | null>;
export type DeskSeen = Partial<Record<DeskPanel, readonly string[]>>;

export function parseDeskSeen(raw: string | null): DeskSeen {
  try {
    const value: unknown = raw ? JSON.parse(raw) : {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: DeskSeen = {};
    for (const panel of DESK_PANELS) {
      const ids = (value as Record<string, unknown>)[panel];
      if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) result[panel] = ids;
    }
    return result;
  } catch { return {}; }
}

export function unseenDeskItems(ids: readonly string[] | null, seen: readonly string[] = []): number {
  const known = new Set(seen);
  return new Set(ids?.filter((id) => !known.has(id)) ?? []).size;
}

export function markDeskPanelSeen(seen: DeskSeen, panel: DeskPanel, ids: readonly string[] | null): DeskSeen {
  return ids === null ? seen : { ...seen, [panel]: [...new Set([...(seen[panel] ?? []), ...ids])] };
}
