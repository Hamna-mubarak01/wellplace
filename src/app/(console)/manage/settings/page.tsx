import type { Metadata } from "next";
import { requireManagement } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { readSettingsSnapshot } from "@/lib/db/queries/settings";
import { ConsolePage } from "@/components/console/console-page";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { SettingsOverview } from "@/components/console/manage/settings-overview";
import { SETTINGS_PANELS } from "@/lib/config/settings-panels";
import type { Json } from "@/types/database.generated";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  await requireManagement();
  const { group } = await searchParams;
  const keys = [...new Set(SETTINGS_PANELS.flatMap((panel) => panel.keys))];
  const listing = await readSettingsSnapshot(await createClient(), keys);

  if (!listing.ok) {
    return (
      <ConsolePage title="Settings">
        <ConsoleReadError
          title="Settings could not be loaded"
          message={listing.message}
          meaning="No setting has changed."
          remedy="Reload the page to try again."
        />
      </ConsolePage>
    );
  }

  const stored = listing.snapshot as Record<string, Json>;

  return (
    <ConsolePage title="Settings" className="min-w-0">
      <SettingsOverview key={group ?? "overview"} stored={stored} initialPanel={group} />
    </ConsolePage>
  );
}
