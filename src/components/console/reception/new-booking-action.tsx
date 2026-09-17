import { createBooking } from "@/app/(console)/reception/actions";
import { WalkInLauncher } from "@/components/console/reception/walk-in-launcher";
import { Button } from "@/components/shared/button";
import { requireSetting } from "@/lib/config";
import { describeImage } from "@/lib/config/cms/image-alt";
import { createClient } from "@/lib/db/server";
import { listAddonCatalogue } from "@/lib/db/queries/pricing";
import { readSettingsSnapshot } from "@/lib/db/queries/settings";
import { readReceptionCustomers } from "@/lib/db/queries/reception-customers";
import { operatingDayInDubai } from "@/lib/services/board-service";

export async function NewBookingAction({ customerId }: { customerId?: string }) {
  const client = await createClient();
  const [settings, listing, customer] = await Promise.all([
    readSettingsSnapshot(client), listAddonCatalogue(client),
    customerId ? readReceptionCustomers(client, "", customerId) : Promise.resolve(null),
  ]);
  if (!settings.ok || !listing.ok || (customerId && (!customer?.ok || !customer.customers[0] || customer.customers[0].is_blocked))) {
    const message = customer?.ok && customer.customers[0]?.is_blocked
      ? "This customer is blocked from booking. Ask Management to review their profile."
      : "Booking details could not be loaded. Refresh the page to try again.";
    return <div className="flex max-w-sm flex-col gap-2"><Button disabled>{customerId ? "Rebooking unavailable" : "New booking unavailable"}</Button><p role="status" className="text-micro text-text-secondary">{message}</p></div>;
  }
  const snapshot = settings.snapshot;
  return <WalkInLauncher
    initialCustomer={customer?.ok ? customer.customers[0] : null}
    triggerLabel={customerId ? "Book again" : "New booking"}
    initialDate={operatingDayInDubai(snapshot)}
    earliestDate={operatingDayInDubai(snapshot)}
    rules={{
      guestsMin: requireSetting(snapshot, "booking.guests_min"), guestsMax: requireSetting(snapshot, "booking.guests_max"),
      childMinAge: requireSetting(snapshot, "booking.child_min_age"), childMaxAge: requireSetting(snapshot, "booking.child_max_age"),
      bookerMinAge: requireSetting(snapshot, "booking.booker_min_age"),
    }}
    offerLabel={requireSetting(snapshot, "pricing.offer_label")}
    taxLabel={requireSetting(snapshot, "tax.label")}
    maxHorizonDays={requireSetting(snapshot, "booking.max_horizon_days")}
            durationsHours={requireSetting(snapshot, "booking.durations_hours")}
    addons={listing.addons.map((addon) => ({ ...addon, imageAlt: describeImage("booking.addons", addon.imagePath ?? "", [addon.name], "add-on") }))}
    onSubmit={createBooking}
  />;
}
