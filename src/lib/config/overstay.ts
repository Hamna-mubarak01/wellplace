import { z } from "zod";

export const OVERSTAY_KEYS = { source: "overrun.rate_source", amount: "overrun.fixed_fils_per_increment", interval: "overrun.increment_minutes" } as const;
export const OVERSTAY_OPTIONS = [
  { value: "regular_hourly", label: "Regular rates", description: "Use the usual adult and child hourly prices to calculate each block of extra time." },
  { value: "offer_hourly", label: "Special Offer rates", description: "Use the applicable offer prices for adults and children to calculate each block of extra time." },
  { value: "fixed", label: "Custom amount in AED", description: "Choose your own amount per guest for each block of extra time that has started." },
] as const;
export const overstayValueSchema = z.object({
  rateSource: z.enum(["regular_hourly", "offer_hourly", "fixed"]),
  amountFils: z.number().int().nonnegative().max(2_147_483_647).nullable(),
});
export type OverstayValue = z.infer<typeof overstayValueSchema>;
export const overstayFormSchema = z.object({
  rateSource: overstayValueSchema.shape.rateSource,
  amountAed: z.string().trim(),
}).transform((value, ctx): OverstayValue => {
  if (!value.amountAed && value.rateSource !== "fixed") return { rateSource: value.rateSource, amountFils: null };
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.amountAed)) {
    ctx.addIssue({ code: "custom", message: "Enter an AED amount with up to two decimal places.", path: ["amountAed"] });
    return z.NEVER;
  }
  const [whole, decimal = ""] = value.amountAed.split(".");
  const amountFils = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  const parsed = overstayValueSchema.safeParse({ rateSource: value.rateSource, amountFils });
  if (!parsed.success) {
    ctx.addIssue({ code: "custom", message: "That amount is too large.", path: ["amountAed"] });
    return z.NEVER;
  }
  return parsed.data;
});
export function overstaySummary(value: unknown, intervalMinutes: number): string {
  const parsed = overstayValueSchema.safeParse(value);
  if (!parsed.success) return "Charges need review";
  const { rateSource, amountFils } = parsed.data;
  if (rateSource === "fixed") return amountFils === null ? "Choose a custom AED amount" : `AED ${(amountFils / 100).toFixed(2)} per guest / each started ${intervalMinutes} minutes`;
  return `${OVERSTAY_OPTIONS.find((option) => option.value === rateSource)?.label} · per guest / each started ${intervalMinutes} minutes`;
}
