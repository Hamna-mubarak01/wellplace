import type { Salutation } from "@/lib/db/queries/waitlist-leads";

export type SalutationFilter = "any" | Salutation;

export const SALUTATION_OPTIONS: ReadonlyArray<{
  value: SalutationFilter;
  label: string;
}> = [
  { value: "any", label: "Everyone" },
  { value: "mr", label: "Mr." },
  { value: "ms", label: "Ms." },
];

export function parseSalutationFilter(raw: string | undefined): SalutationFilter {
  return raw === "mr" || raw === "ms" ? raw : "any";
}

export function salutationLabel(value: Salutation | null): string {
  if (value === "mr") return "Mr.";
  if (value === "ms") return "Ms.";
  return "—";
}
