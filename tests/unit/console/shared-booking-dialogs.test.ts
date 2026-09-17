import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SHARED = "src/components/console/shared/booking";
const RECEPTION = "src/components/console/reception";
const MANAGE_ACTIONS = "src/app/(console)/manage/bookings/actions.ts";
const MANAGE_PAGE_ACTIONS = "src/components/console/manage/bookings/booking-page-actions.tsx";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("[Project owner's direction 2026-09-11] the booking dialogs are shared, and each console supplies its own actions", () => {
  it("never lets a shared dialog import either console's server actions", () => {
    for (const name of readdirSync(SHARED)) {
      const source = read(join(SHARED, name));
      expect(source, `${name} must take its action as a prop`).not.toContain("@/app/(console)");
    }
  });

  it("keeps Reception's call sites on Reception's own actions", () => {
    const sites: Readonly<Record<string, readonly string[]>> = {
      "booking-actions.tsx": ["extendBooking", "shared/booking/extend-booking-dialog"],
      "reschedule-dialog.tsx": ["rescheduleBooking", "shared/booking/reschedule-booking-dialog"],
      "move-suite-dialog.tsx": ["moveBooking", "shared/booking/move-booking-dialog"],
      "booking-notes-form.tsx": ["updateInternalNote"],
    };
    for (const [name, expected] of Object.entries(sites)) {
      const source = read(join(RECEPTION, name));
      expect(source, name).toContain('from "@/app/(console)/reception/actions"');
      expect(source, name).not.toContain("manage/bookings/actions");
      for (const fragment of expected) expect(source, name).toContain(fragment);
    }
  });

  it("gives the Management booking page Management's actions only", () => {
    const source = read(MANAGE_PAGE_ACTIONS);
    expect(source).toContain('from "@/app/(console)/manage/bookings/actions"');
    expect(source).not.toContain("reception/actions");
  });

  it("guards every Management booking action with requireManagement before anything else", () => {
    const source = read(MANAGE_ACTIONS);
    const exported = source.match(/export async function \w+/g) ?? [];
    const guarded = source.match(/\n {2}(?:const session = )?await requireManagement\(\);/g) ?? [];
    expect(exported.length).toBeGreaterThan(0);
    expect(guarded).toHaveLength(exported.length);
    expect(source).not.toContain("requireStaff");
    expect(source).not.toContain("requireReception");
  });

  it("offers Management none of the Reception-only desk actions", () => {
    const source = [read(MANAGE_ACTIONS), read(MANAGE_PAGE_ACTIONS)].join("\n");
    for (const deskOnly of ["cancelBooking", "checkIn", "checkOut", "markNoShow", "recordOverrun", "markLateArrival", "recordPayment", "recordArrival"]) {
      expect(source, deskOnly).not.toContain(deskOnly);
    }
  });
});
