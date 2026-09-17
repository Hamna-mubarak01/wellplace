import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(), settings: vi.fn(), board: vi.fn(), period: vi.fn(),
  addons: vi.fn(), alerts: vi.fn(), tasks: vi.fn(), notes: vi.fn(), cleaning: vi.fn(), staff: vi.fn(), arrivals: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireReception: mocks.guard }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/app/(console)/reception/actions", () => ({ createBooking: vi.fn() }));
vi.mock("@/lib/db/queries/settings", () => ({ loadSettingsSnapshot: mocks.settings }));
vi.mock("@/lib/db/queries/pricing", () => ({ listAddonCatalogue: mocks.addons }));
vi.mock("@/lib/db/queries/operations", () => ({ listOpenAlerts: mocks.alerts, listTasks: mocks.tasks, listShiftNotes: mocks.notes, listCleaningTasks: mocks.cleaning }));
vi.mock("@/lib/db/queries/staff", () => ({ listStaff: mocks.staff }));
vi.mock("@/lib/db/queries/bookings", () => ({ listArrivals: mocks.arrivals }));
vi.mock("@/lib/config", () => ({ requireSetting: (_: unknown, key: string) => key === "reception.board_default_view" ? "day" : key === "booking.durations_hours" ? [2, 3] : 15 }));
vi.mock("@/lib/services/board-service", async (original) => ({
  ...await original<typeof import("@/lib/services/board-service")>(),
  getBoard: mocks.board,
  getPeriodBoard: mocks.period,
  dayWindow: () => ({ status: "open", window: { start: "2026-09-12T06:00:00Z", end: "2026-09-12T18:00:00Z" } }),
  operatingDayInDubai: () => "2026-09-12",
  businessDayWindow: () => ({ start: "2026-09-11T20:00:00Z", end: "2026-09-12T20:00:00Z" }),
}));
vi.mock("@/components/console/reception/desk-updates", () => ({ DeskUpdates: () => null }));
vi.mock("@/components/console/reception/alert-list", () => ({ AlertList: () => null }));
vi.mock("@/components/console/reception/front-desk-preview", () => ({ FrontDeskPreview: () => null }));
vi.mock("@/components/console/reception/shift-note-list", () => ({ ShiftNoteList: () => null }));
vi.mock("@/components/console/reception/cleaning-board", () => ({ CleaningBoard: () => null }));
vi.mock("@/components/console/reception/task-list", () => ({ TaskList: () => null }));
vi.mock("@/components/console/reception/next-arrival-card", () => ({ NextArrivalCard: () => null }));
vi.mock("@/components/console/reception/timeline-zoom", () => ({ TimelineZoomProvider: () => null }));
vi.mock("@/components/shared/console-read-error", () => ({ ConsoleReadError: () => null }));
vi.mock("@/components/shared/button", () => ({ Button: () => null }));
vi.mock("@/components/console/reception/front-desk-search", () => ({ FrontDeskSearch: () => null }));
vi.mock("@/components/console/reception/desk-workspace", () => ({ DeskWorkspace: () => null }));
vi.mock("@/components/console/console-surface", () => ({ ConsoleNotice: () => null, ConsoleSection: () => null }));
vi.mock("@/components/console/reception/board-legend", () => ({ BoardLegend: () => null }));
vi.mock("@/components/console/reception/schedule-toolbar", () => ({ ScheduleToolbar: () => null }));
vi.mock("@/components/console/reception/week-suite-schedule", () => ({ WeekSuiteSchedule: () => null }));
vi.mock("@/components/console/reception/period-grid", () => ({ PeriodGrid: () => null }));
vi.mock("@/components/console/reception/suite-timeline", () => ({ SuiteTimeline: () => null }));
vi.mock("@/components/console/reception/walk-in-launcher", () => ({ WalkInLauncher: () => null }));

import FrontDeskPage from "@/app/(console)/reception/page";

describe("[OUR CHOICE; owner request 12 September 2026] Front desk critical rendering path", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue({ userId: "reception-a" });
    mocks.settings.mockResolvedValue({});
    mocks.board.mockResolvedValue({ suites: [], entries: [] });
    mocks.period.mockResolvedValue({ suites: [], byDay: new Map() });
    for (const read of [mocks.addons, mocks.alerts, mocks.tasks, mocks.notes, mocks.cleaning, mocks.staff, mocks.arrivals]) {
      read.mockReturnValue(new Promise(() => {}));
    }
  });

  it.each(["day", "timeline", "week", "month"])("returns the %s schedule while every secondary read is still pending", async (view) => {
    const result = await FrontDeskPage({ searchParams: Promise.resolve({ view, date: "2026-09-12" }) });
    expect(isValidElement(result)).toBe(true);
    expect(mocks.guard).toHaveBeenCalledOnce();
    expect(mocks.settings).toHaveBeenCalledOnce();
    expect(view === "day" || view === "timeline" ? mocks.board : mocks.period).toHaveBeenCalledOnce();
    for (const read of [mocks.addons, mocks.alerts, mocks.tasks, mocks.notes, mocks.cleaning, mocks.staff, mocks.arrivals]) {
      expect(read).toHaveBeenCalledOnce();
    }
    const workspace = result.props.children[1] as ReactElement<{ actions: ReactElement; updates: ReactElement }>;
    expect(workspace.props.actions.props).toHaveProperty("fallback");
    expect(workspace.props.updates.props).toHaveProperty("fallback");
  });

  it("does not load operational data if access is denied", async () => {
    mocks.guard.mockRejectedValue(new Error("Access denied"));
    await expect(FrontDeskPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("Access denied");
    expect(mocks.settings).not.toHaveBeenCalled();
    expect(mocks.board).not.toHaveBeenCalled();
    expect(mocks.staff).not.toHaveBeenCalled();
  });

  it("keeps failed update reads unknown instead of reporting empty panels", async () => {
    for (const read of [mocks.alerts, mocks.tasks, mocks.notes, mocks.cleaning, mocks.staff, mocks.arrivals]) {
      read.mockResolvedValue({ ok: false, message: "Temporarily unavailable" });
    }
    const result = await FrontDeskPage({ searchParams: Promise.resolve({ date: "2026-09-12" }) });
    const workspace = result.props.children[1] as ReactElement<{ updates: ReactElement<{ children: ReactElement }> }>;
    const updates = workspace.props.updates.props.children;
    const render = updates.type as (props: unknown) => Promise<ReactElement<{ items: unknown; counts: unknown }>>;
    const panel = await render(updates.props);
    expect(panel.props.items).toEqual({ arrivals: null, alerts: null, notes: null, tasks: null });
    expect(panel.props.counts).toEqual({ notes: null });
  });
});
