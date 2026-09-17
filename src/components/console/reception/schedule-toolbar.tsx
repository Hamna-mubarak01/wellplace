import { BoardDateNav } from "@/components/console/reception/board-date-nav";
import { BoardViewTabs, type BoardView } from "@/components/console/reception/board-view-tabs";
import { TimelineZoomControls } from "@/components/console/reception/timeline-zoom";

export function ScheduleToolbar({ view, date, today, step, endDate, preview }: { view: BoardView; date: string; today?: string; step: number; endDate?: string; preview?: boolean }) {
  return <div className="reception-schedule-toolbar">
    <BoardDateNav view={view} date={date} today={today} step={step} endDate={endDate} preview={preview} />
    <BoardViewTabs current={view} date={date} preview={preview} />
    {(view === "day" || view === "timeline") && <TimelineZoomControls />}
  </div>;
}
