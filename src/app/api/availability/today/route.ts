import { connection } from "next/server";

import { loadTodayBookingStatus } from "@/lib/services/today-booking-service";

export async function GET() {
  await connection();
  const status = await loadTodayBookingStatus();
  return Response.json(status ?? { kind: "unavailable" }, {
    headers: { "cache-control": "no-store" },
  });
}
