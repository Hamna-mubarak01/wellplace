import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ effect: vi.fn(), refresh: vi.fn(), pending: false }));
vi.mock("react", () => ({
  useEffect: mocks.effect,
  useTransition: () => [mocks.pending, (action: () => void) => action()],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }), usePathname: () => "/reception" }));

import { ReceptionAutoRefresh } from "@/components/console/reception/auto-refresh";
import { CONSOLE_REFRESH_MILLISECONDS } from "@/lib/config/console-refresh";

let cleanup: (() => void) | undefined;
let browser: EventTarget;
let page: EventTarget & { visibilityState: string; querySelector: ReturnType<typeof vi.fn>; activeElement: { matches: ReturnType<typeof vi.fn> } };
let network: { onLine: boolean };

function mount() {
  ReceptionAutoRefresh();
  cleanup = mocks.effect.mock.lastCall![0]();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.pending = false;
  browser = Object.assign(new EventTarget(), { location: { search: "" }, setInterval, clearInterval, setTimeout, clearTimeout });
  page = Object.assign(new EventTarget(), { visibilityState: "visible", querySelector: vi.fn(() => null), activeElement: { matches: vi.fn(() => false) } });
  network = { onLine: true };
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", page);
  vi.stubGlobal("navigator", network);
});
afterEach(() => { cleanup?.(); cleanup = undefined; vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("[OUR CHOICE; owner request 12 September 2026] Reception refresh request coordination", () => {
  it("coalesces focus, reconnect and visibility events before React commits the pending state", () => {
    mount();
    browser.dispatchEvent(new Event("focus"));
    browser.dispatchEvent(new Event("online"));
    page.dispatchEvent(new Event("visibilitychange"));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not leave polling locked if an immediate refresh completes without a pending render", () => {
    mount();
    browser.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(CONSOLE_REFRESH_MILLISECONDS);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it.each(["pending", "hidden", "offline", "editing", "navigating"])("does not compete with %s work", (state) => {
    if (state === "pending") mocks.pending = true;
    if (state === "hidden") page.visibilityState = "hidden";
    if (state === "offline") network.onLine = false;
    if (state === "editing") page.activeElement.matches.mockReturnValue(true);
    if (state === "navigating") page.querySelector.mockImplementation((selector: string) => selector.includes('[data-console-navigating="true"]') ? {} : null);
    mount();
    browser.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(CONSOLE_REFRESH_MILLISECONDS);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("continues polling after a completed refresh and removes timers and listeners on departure", () => {
    mount();
    vi.advanceTimersByTime(CONSOLE_REFRESH_MILLISECONDS);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    cleanup?.();
    mount();
    vi.advanceTimersByTime(CONSOLE_REFRESH_MILLISECONDS);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    cleanup?.();
    browser.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(CONSOLE_REFRESH_MILLISECONDS);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });
});
