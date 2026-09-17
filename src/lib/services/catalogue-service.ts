import { z } from "zod";
import { catalogueInputError, addonEditorSchema, priceEditorSchema } from "@/lib/config/catalogue";
import { saveCatalogueItem } from "@/lib/db/rpc";
import type { WellPlaceClient } from "@/lib/db/types";

export async function saveManagementCatalogueItem(client: WellPlaceClient, raw: unknown) {
  const input = z.object({ kind: z.enum(["price", "addon"]), values: z.unknown(), expected: z.json() }).strict().safeParse(raw);
  if (!input.success) return { ok: false as const, message: "Check your entries and try again." };
  const schema = input.data.kind === "price" ? priceEditorSchema : addonEditorSchema;
  const values = schema.safeParse(input.data.values);
  if (!values.success) return { ok: false as const, message: catalogueInputError(values.error.issues[0]) };
  return saveCatalogueItem(client, input.data.kind, values.data, input.data.expected);
}
