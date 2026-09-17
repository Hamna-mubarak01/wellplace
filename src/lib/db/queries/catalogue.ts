import { z } from "zod";
import { priceEditorSchema, addonEditorSchema } from "@/lib/config/catalogue";
import type { WellPlaceClient } from "@/lib/db/types";

export async function listManagementCatalogue(client: WellPlaceClient) {
  const [prices, addons] = await Promise.all([
    client.from("management_price_rules").select("*").order("priority", { ascending: false }).order("from_hour"),
    client.from("management_addons").select("*").order("sort_order").order("name"),
  ]);
  if (prices.error || addons.error) {
    console.error("[catalogue] read failed", prices.error?.code, addons.error?.code);
    return { ok: false as const, message: "Prices and add-ons could not be loaded. Reload the page." };
  }
  const rates = z.array(priceEditorSchema).safeParse(prices.data);
  const items = z.array(addonEditorSchema).safeParse(addons.data);
  if (!rates.success || !items.success) return { ok: false as const, message: "The saved catalogue needs review. Contact support." };
  return { ok: true as const, prices: rates.data, addons: items.data };
}
