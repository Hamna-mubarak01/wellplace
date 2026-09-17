import { cleaningBufferOptionsSchema } from "@/lib/config/cleaning-buffer";
import type { WellPlaceClient } from "@/lib/db/types";
export async function readCleaningBufferOptions(
  client: WellPlaceClient,
  bookingId: string,
) {
  const { data, error } = await client.rpc("booking_buffer_options", {
    p_booking_id: bookingId,
  });
  if (error)
    throw new Error(
      "The current cleaning time could not be loaded. Please try again.",
    );
  return cleaningBufferOptionsSchema.parse(data);
}
