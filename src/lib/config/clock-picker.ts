export const CLOCK_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));
export const CLOCK_MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
export const CLOCK_PERIODS = ["AM", "PM"] as const;
export type ClockPeriod = (typeof CLOCK_PERIODS)[number];

export function clockParts(value: string): { hour: string; minute: string; period: ClockPeriod } {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return { hour: "12", minute: "00", period: "AM" };
  const [hour, minute] = value.split(":");
  return { hour: String(Number(hour) % 12 || 12), minute, period: Number(hour) >= 12 ? "PM" : "AM" };
}

export function clockValue(parts: { hour: string; minute: string; period: ClockPeriod }): string {
  const hour = Number(parts.hour) % 12 + (parts.period === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${parts.minute}`;
}

export function clockLabel(value: string): string {
  if (!value) return "Choose time";
  const parts = clockParts(value);
  return `${parts.hour}:${parts.minute} ${parts.period}`;
}
