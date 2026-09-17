import { z } from "zod";

// [§CMS and waitlist review] Shared by the list and exports.
export function parseWaitlistFilters(params: { get(name: string): string | null }): { scope: "active" | "archived" | "all"; from?: string; to?: string; source?: string; campaign?: string; marketing?: "granted" | "withdrawn" | "unknown" } {
  const date = (key: string) => { const result = z.iso.date().safeParse(params.get(key)); return result.success ? result.data : undefined; };
  const scope = params.get("scope");
  const marketing = params.get("marketing");
  return {
    scope: scope === "active" || scope === "archived" ? scope : "all" as const,
    from: date("from"), to: date("to"),
    source: params.get("source")?.trim() || undefined,
    campaign: params.get("campaign")?.trim() || undefined,
    marketing: marketing === "granted" || marketing === "withdrawn" || marketing === "unknown" ? marketing : undefined,
  };
}
