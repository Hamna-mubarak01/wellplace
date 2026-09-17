"use server";

import { z } from "zod";
import { requireReception } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { readReceptionCustomers, readReceptionSuiteChoices } from "@/lib/db/queries/reception-customers";

export async function searchBookingCustomers(search: string) {
  await requireReception();
  const parsed = z.string().trim().max(254).safeParse(search);
  if (!parsed.success) return { ok: false as const, message: "Enter a name, email or phone number." };
  return readReceptionCustomers(await createClient(), parsed.data);
}

export async function bookingSuiteChoices(startsAt: string, durationHours: number) {
  await requireReception();
  const parsed = z.object({ startsAt: z.iso.datetime({ offset: true }), durationHours: z.number().int().positive() }).safeParse({ startsAt, durationHours });
  if (!parsed.success) return { ok: false as const, message: "Choose a valid visit time and duration." };
  return readReceptionSuiteChoices(await createClient(), parsed.data.startsAt, parsed.data.durationHours);
}
