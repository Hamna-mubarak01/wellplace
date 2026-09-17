import { describe, expect, it } from "vitest";
import { suiteStatusChangeSchema } from "@/lib/validation/suite-status";

const suiteId = "c9300000-0000-4000-8000-000000000001";

describe("[CLIENT] Reception manual availability holds", () => {
  it.each(["not_ready", "blocked", "maintenance", "out_of_service"])("requires an actual reason for %s", (status) => {
    for (const reason of [undefined, "", "   "]) {
      expect(suiteStatusChangeSchema.safeParse({ suiteId, status, reason }).success).toBe(false);
    }
    expect(suiteStatusChangeSchema.parse({ suiteId, status, reason: "  Cleaning needs another ten minutes  " }).reason).toBe("Cleaning needs another ten minutes");
  });
  it("lets Reception release a hold without inventing another incident reason", () => {
    expect(suiteStatusChangeSchema.safeParse({ suiteId, status: "available" }).success).toBe(true);
  });
  it("rejects an invalid status or suite identifier before the RPC", () => {
    expect(suiteStatusChangeSchema.safeParse({ suiteId, status: "anything" }).success).toBe(false);
    expect(suiteStatusChangeSchema.safeParse({ suiteId: "missing", status: "available" }).success).toBe(false);
  });
});
