"use server";

import { z } from "zod";
import { requireReception } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { readBookingChangeReasons } from "@/lib/db/queries/booking-activity";
import { findBooking } from "@/lib/db/queries/bookings";
import { readCleaningBufferOptions } from "@/lib/db/queries/cleaning-buffer";

export async function loadScheduleBooking(bookingId: string) {
  await requireReception();
  if (!z.uuid().safeParse(bookingId).success)
    return { outcome: "failed" as const, message: "Choose a valid booking." };
  const client = await createClient();
  const [result, changes] = await Promise.all([
    findBooking(client, bookingId),
    readBookingChangeReasons(client, bookingId),
  ]);
  if (result.outcome !== "found")
    return {
      outcome: "failed" as const,
      message: "Booking details could not be loaded. Please try again.",
    };
  const {
    guestEmail,
    guestPhone,
    adults,
    children,
    totalFils,
    source,
    addons,
    personalRequest,
    internalNote,
    warningNote,
    guests,
    isComplimentary,
  } = result.booking;
  return {
    outcome: "found" as const,
    changes,
    booking: {
      guestEmail,
      guestPhone,
      adults,
      children,
      totalFils,
      source,
      addons,
      personalRequest,
      internalNote,
      warningNote,
      guests,
      isComplimentary,
    },
  };
}

export async function loadScheduleBuffer(bookingId: string) {
  await requireReception();
  if (!z.uuid().safeParse(bookingId).success)
    return { outcome: "failed" as const, message: "Choose a valid booking." };
  try {
    return {
      outcome: "found" as const,
      options: await readCleaningBufferOptions(await createClient(), bookingId),
    };
  } catch {
    return {
      outcome: "failed" as const,
      message:
        "The current cleaning time could not be loaded. Please try again.",
    };
  }
}
