import { z } from "zod";
import { NEVER_AUTO_ALLOCATED, SUITE_STATUSES } from "@/lib/config/suite-status";
import { idSchema } from "@/lib/validation/console-inputs";
import { reasonSchema } from "@/lib/validation/audit-reason";

export const suiteStatusChangeSchema = z.object({
  suiteId: idSchema,
  status: z.enum(SUITE_STATUSES),
  reason: reasonSchema.optional(),
}).superRefine((input, ctx) => {
  if (NEVER_AUTO_ALLOCATED.includes(input.status) && !input.reason) {
    ctx.addIssue({ code: "custom", path: ["reason"], message: "Explain why this suite is being held out of availability." });
  }
});
