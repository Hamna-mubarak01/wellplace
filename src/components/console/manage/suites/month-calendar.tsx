"use client";

import { createContext, use, type ReactNode } from "react";
import type { DayProps } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";

export interface MonthCalendarDay {
  readonly label: string;
  readonly content: ReactNode;
}

type RenderDay = (isoDate: string) => MonthCalendarDay;

const RenderDayContext = createContext<RenderDay>((isoDate) => ({ label: isoDate, content: null }));

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

function localDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day ?? 1);
}

function MonthDay({ day, modifiers }: DayProps) {
  const render = use(RenderDayContext);

  if (modifiers.hidden || day.outside) {
    return <td aria-hidden="true" className="p-0.5" />;
  }

  const view = render(day.isoDate);
  return (
    <td role="gridcell" aria-label={view.label} data-day={day.isoDate} className="p-0.5 align-top">
      {view.content}
    </td>
  );
}

export interface MonthCalendarProps {
  month: string;
  today: string;
  renderDay: RenderDay;
}

export function MonthCalendar({ month, today, renderDay }: MonthCalendarProps) {
  return (
    <RenderDayContext value={renderDay}>
      <Calendar
        month={localDate(`${month}-01`)}
        today={localDate(today)}
        hideNavigation
        showOutsideDays={false}
        weekStartsOn={1}
        formatters={{ formatWeekdayName: (date) => WEEKDAY.format(date) }}
        className="w-full bg-transparent p-0"
        classNames={{
          root: "w-full",
          months: "relative flex w-full flex-col",
          month: "flex w-full flex-col",
          month_caption: "sr-only",
          month_grid: "w-full table-fixed border-collapse",
          weekdays: "",
          weekday: "pb-2 text-center text-console-label font-normal tracking-label text-text-muted uppercase",
          week: "",
          day: "p-0.5",
        }}
        components={{ Day: MonthDay }}
      />
    </RenderDayContext>
  );
}
