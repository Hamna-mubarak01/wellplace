import { z } from "zod";

export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];
export const WEEKDAY_LABEL: Readonly<Record<WeekdayKey, string>> = {
  sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday",
};
export const HOURS_EDITOR = {
  scheduleNameMaxLength: 80,
  minuteStep: 5,
  newWindow: { opens: "10:00", closes: "22:00" },
  publicDays: 7,
} as const;

export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid time.");
const openingWindow = z.object({ opens: timeOfDay, closes: timeOfDay }).strict()
  .refine((value) => value.closes !== value.opens, {
    message: "Opening and closing times must differ. An earlier closing time means the following day.", path: ["closes"],
  });
export const openingWindowsSchema = z.array(openingWindow).superRefine((windows, ctx) => {
  const sorted = windows.map((window, index) => ({ ...window, index }))
    .sort((a, b) => a.opens.localeCompare(b.opens));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].closes < sorted[i - 1].opens || sorted[i].opens < sorted[i - 1].closes) ctx.addIssue({
      code: "custom", path: [sorted[i].index, "opens"],
      message: "Opening windows must not overlap. Adjust or remove this window.",
    });
  }
});
export const weeklyHoursSchema = z.object({
  sun: openingWindowsSchema, mon: openingWindowsSchema, tue: openingWindowsSchema,
  wed: openingWindowsSchema, thu: openingWindowsSchema, fri: openingWindowsSchema,
  sat: openingWindowsSchema,
}).strict();
const calendarDate = z.iso.date({ error: "Choose a valid calendar date." });
const dateRange = z.object({ from: calendarDate, to: calendarDate });
export const seasonalHoursSchema = z.object({
  periods: z.array(dateRange.extend({ name: z.string().trim().max(HOURS_EDITOR.scheduleNameMaxLength, "Use a shorter schedule name.").optional(), hours: weeklyHoursSchema }).strict()).default([]),
}).strict().superRefine(({ periods }, ctx) => {
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    if (period.to < period.from) ctx.addIssue({ code: "custom", path: ["periods", i, "to"], message: "End date must be on or after the start date." });
    if (periods.slice(0, i).some((other) => period.from <= other.to && period.to >= other.from)) {
      ctx.addIssue({ code: "custom", path: ["periods", i, "from"], message: "Seasons must not overlap. Adjust the date range." });
    }
  }
});
export const openingExceptionsSchema = z.array(z.object({
  date: calendarDate, windows: openingWindowsSchema,
}).strict()).superRefine((entries, ctx) => {
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.date)) ctx.addIssue({ code: "custom", path: [index, "date"], message: "This date already has one-off hours. Edit that entry instead." });
    seen.add(entry.date);
  });
});
export const closuresSchema = z.array(dateRange.strict()).superRefine((entries, ctx) => {
  entries.forEach((entry, index) => {
    if (entry.to < entry.from) ctx.addIssue({ code: "custom", path: [index, "to"], message: "End date must be on or after the start date." });
  });
});
export type OpeningWindowValue = z.infer<typeof openingWindow>;
export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;
export type SeasonalHours = z.infer<typeof seasonalHoursSchema>;
export type OpeningExceptions = z.infer<typeof openingExceptionsSchema>;
export type Closures = z.infer<typeof closuresSchema>;
export const EMPTY_WEEK: WeeklyHours = { sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [] };

export const HOURS_SETTING_KEYS = ["hours.regular", "hours.seasonal", "hours.exceptions", "hours.closures"] as const;
export type HoursSettingKey = (typeof HOURS_SETTING_KEYS)[number];
export function isHoursSetting(key: string): key is HoursSettingKey {
  return HOURS_SETTING_KEYS.some((candidate) => candidate === key);
}
export const HOURS_COPY = {
  "hours.regular": { title: "Regular opening hours", description: "Set your usual week. Closing earlier than opening means the following day. Add another window for a break between sessions." },
  "hours.seasonal": { title: "Seasonal opening hours", description: "Set a different week for a date range. Regular hours return after the end date." },
  "hours.exceptions": { title: "One-off opening hours", description: "Change the hours for a specific date. These replace regular and seasonal hours for that day." },
  "hours.closures": { title: "Full closures", description: "Close the venue for one day or a date range. Closures take priority over every other schedule." },
} as const;

// [§Operational corrections] Closing is on the following day.
export const LAUNCH_WEEK: WeeklyHours = Object.fromEntries(
  WEEKDAY_KEYS.map((day) => [day, [{ opens: "08:00", closes: "03:00" }]]),
) as WeeklyHours;
