import { describe, expect, it } from "vitest";

import {
  INVITE_LINK_MINUTES,
  INVITE_VALID_HOURS,
  inviteLinkLifetimeLabel,
} from "@/lib/config/staff-access";

describe("staff access windows", () => {
  it("keeps the invitation and its emailed link on one clock", () => {
    expect(INVITE_LINK_MINUTES).toBe(INVITE_VALID_HOURS * 60);
  });

  it("is the 24 hours that Supabase Auth and the migration were set to", () => {
    expect(INVITE_VALID_HOURS).toBe(24);
    expect(INVITE_LINK_MINUTES).toBe(1440);
  });

  it("says the lifetime the way a person would", () => {
    expect(inviteLinkLifetimeLabel()).toBe("24 hours");
  });
});
