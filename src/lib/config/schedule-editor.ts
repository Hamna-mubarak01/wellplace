import { z } from "zod";
import { WEEKDAY_KEYS } from "@/lib/config/opening-hours";

const windowDraft = z.object({ opens: z.string(), closes: z.string() });
export const scheduleWeekDraft = z.record(z.enum(WEEKDAY_KEYS), z.array(windowDraft));
export const schedulePeriodsDraft = z.object({ periods: z.array(z.object({ name: z.string().optional(), from: z.string(), to: z.string(), hours: scheduleWeekDraft })) });
export const scheduleDatesDraft = z.array(z.object({ date: z.string(), windows: z.array(windowDraft) }));
export const scheduleClosuresDraft = z.array(z.object({ from: z.string(), to: z.string() }));
