import { z } from "zod";

export function suiteBlockWindow(from: string, to: string, wholeDays: boolean):
  | { ok: true; from: string; to: string }
  | { ok: false; message: string } {
  const schema = wholeDays ? z.iso.date() : z.iso.datetime({ local: true, precision: -1 });
  if (!schema.safeParse(from).success || !schema.safeParse(to).success) {
    return { ok: false, message: "Choose a valid start and end." };
  }
  const start = new Date(`${from}${wholeDays ? "T00:00" : ""}:00+04:00`);
  const end = new Date(`${to}${wholeDays ? "T00:00" : ""}:00+04:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, message: "Choose a valid start and end." };
  }
  if (wholeDays) end.setUTCDate(end.getUTCDate() + 1);
  if (end <= start) return { ok: false, message: "The end must come after the start." };
  return { ok: true, from: start.toISOString(), to: end.toISOString() };
}
