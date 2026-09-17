import type { Metadata } from "next";
import { requireManagement } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { listManagementCatalogue } from "@/lib/db/queries/catalogue";
import { ConsolePage } from "@/components/console/console-page";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { CatalogueWorkspace } from "@/components/console/manage/catalogue-workspace";

export const metadata: Metadata = { title: "Prices and add-ons", robots: { index: false, follow: false } };

export default async function PricingPage() {
  await requireManagement();
  const catalogue = await listManagementCatalogue(await createClient());

  return (
    <ConsolePage title="Prices and add-ons">
      {catalogue.ok ? (
        <CatalogueWorkspace prices={catalogue.prices} addons={catalogue.addons} />
      ) : (
        <ConsoleReadError
          title="Prices and add-ons could not be loaded"
          message={catalogue.message}
          meaning="Prices and add-ons have not changed."
          remedy="Reload the page to try again."
        />
      )}
    </ConsolePage>
  );
}
