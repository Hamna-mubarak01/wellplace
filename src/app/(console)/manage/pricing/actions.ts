"use server";

import { revalidatePath } from "next/cache";
import { requireManagement } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { saveManagementCatalogueItem } from "@/lib/services/catalogue-service";

export async function saveCatalogue(input: unknown) {
  await requireManagement();
  const result = await saveManagementCatalogueItem(await createClient(), input);
  if (result.ok) {
    revalidatePath("/manage/pricing");
    revalidatePath("/book");
    revalidatePath("/reception", "layout");
  }
  return result;
}
