import { getSetting } from "@/lib/config";
import { loadPublicBookingSettings } from "@/lib/db/queries/public-settings";
import { createClient } from "@/lib/db/server";
import { organisationJsonLd } from "@/lib/config/seo";

export interface JsonLdProps {
  data: object;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export async function StructuredData() {
  let address: readonly string[] | undefined;
  try {
    const settings = await loadPublicBookingSettings(await createClient());
    if (settings.ok) address = getSetting(settings.snapshot, "contact.address")?.split("\n").filter(Boolean);
  } catch { /* The built-in venue address remains available. */ }
  return <JsonLd data={organisationJsonLd(address)} />;
}
