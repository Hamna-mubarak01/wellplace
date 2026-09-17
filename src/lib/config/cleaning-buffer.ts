import { z } from "zod";
export const cleaningBufferOptionsSchema = z.object({
  bookingId: z.uuid(),
  endsAt: z.string(),
  currentMinutes: z.number().int().nonnegative(),
  defaultMinutes: z.number().int().nonnegative(),
  maxMinutes: z.number().int().nonnegative(),
  limitAt: z.string().nullable(),
  limitKind: z.enum(["next_reservation", "closing"]),
  canEdit: z.boolean(),
  canShorten: z.boolean(),
  message: z.string().nullable(),
});
export type CleaningBufferOptions = z.infer<typeof cleaningBufferOptionsSchema>;
