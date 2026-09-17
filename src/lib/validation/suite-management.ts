import { z } from "zod";
import { SUITE_NOTE_MAX_LENGTH, SUITE_PRIORITY_MIN, SUITE_PRIORITY_MAX, SUITE_NAME_MAX_LENGTH, SUITE_NUMBER_MAX, SUITE_NUMBER_MIN } from "@/lib/config/suite-management";

export const suiteConfigurationSchema = z.object({
  suiteId: z.uuid("That suite is not valid."),
  suiteNumber: z.number().int().min(SUITE_NUMBER_MIN, "Enter a positive suite number.").max(SUITE_NUMBER_MAX),
  displayName: z.string().trim().max(SUITE_NAME_MAX_LENGTH, `Keep the name to ${SUITE_NAME_MAX_LENGTH} characters or fewer.`),
  create: z.boolean(),
  priority: z.number().int().min(SUITE_PRIORITY_MIN).max(SUITE_PRIORITY_MAX),
  internalNote: z.string().trim().max(SUITE_NOTE_MAX_LENGTH),
});
export type SuiteConfigurationInput = z.infer<typeof suiteConfigurationSchema>;
