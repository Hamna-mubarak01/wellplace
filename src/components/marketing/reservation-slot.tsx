import { Suspense } from "react";

import { ReservationSection } from "@/components/marketing/reservation-section";
import { reservationFor } from "@/lib/config/cms/reservation-content";
import type { ReservationPage } from "@/lib/config/reservation";
import { getSiteChrome } from "@/lib/services/site-content";

export interface ReservationSlotProps {
  page: ReservationPage;
  animated?: boolean;
  content?: ReturnType<typeof reservationFor>;
}

async function LiveReservation({ page, animated }: ReservationSlotProps) {
  const reservation = reservationFor((await getSiteChrome()).reservation, page);
  if (!reservation) return null;
  return <ReservationSection content={reservation} animated={animated} />;
}

export function ReservationSlot({ page, animated, content }: ReservationSlotProps) {
  if (content !== undefined) {
    return content ? <ReservationSection content={content} animated={animated} /> : null;
  }
  return (
    <Suspense fallback={null}>
      <LiveReservation page={page} animated={animated} />
    </Suspense>
  );
}
