import { z } from "zod";

import { calculateAge, isRealDate } from "@/lib/domain/age";

const NAME_MAX = 80;
const FREE_TEXT_MAX = 255;
const EMAIL_MAX = 254;

export const SALUTATIONS = ["mr", "ms"] as const;

export const salutationSchema = z.enum(SALUTATIONS);

export const dateOfBirthSchema = z
  .object({
    day: z.coerce.number().int().min(1).max(31),
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(1900),
  })
  .refine(isRealDate, {
    message: "That date does not exist. Check the day and month.",
  })
  .refine(
    ({ year }) => year <= new Date().getUTCFullYear(),
    { message: "The year cannot be in the future." },
  );

export const phoneSchema = z.object({
  e164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Enter a mobile number including the area code."),
  countryIso2: z.string().length(2).toUpperCase(),
});

const NO_CONTROL_CHARS = /^[^\u0000-\u001f\u007f]*$/;

const attributionValue = z
  .string()
  .max(FREE_TEXT_MAX)
  .regex(NO_CONTROL_CHARS, "Attribution values cannot contain control characters.")
  .refine((v) => !/^[=+\-@\t\r]/.test(v), {
    message: "Attribution values cannot begin with a spreadsheet formula character.",
  })
  .optional();

export const attributionSchema = z.object({
  source: attributionValue,
  referrer: z
    .string()
    .max(2048)
    .regex(NO_CONTROL_CHARS, "A referrer cannot contain control characters.")
    .refine((v) => v === "" || /^https?:\/\//.test(v), {
      message: "A referrer must be an http or https URL.",
    })
    .optional(),
  utmSource: attributionValue,
  utmMedium: attributionValue,
  utmCampaign: attributionValue,
  utmContent: attributionValue,
  utmTerm: attributionValue,
});

export const waitlistSubmissionSchema = z.object({
  salutation: salutationSchema,
  firstName: z.string().trim().min(1, "Enter your first name.").max(NAME_MAX),
  lastName: z.string().trim().min(1, "Enter your last name.").max(NAME_MAX),
  email: z.email("Enter an email address we can reach you on.").max(EMAIL_MAX),
  dateOfBirth: dateOfBirthSchema,
  phone: phoneSchema,
  attribution: attributionSchema.default({}),

  termsAccepted: z.literal(true, {
    error: "Please accept the Legal, Privacy & Marketing Terms to join.",
  }),

  website: z.string().max(0).optional(),
});

export type WaitlistSubmission = z.infer<typeof waitlistSubmissionSchema>;
export type DateOfBirthInput = z.infer<typeof dateOfBirthSchema>;
export type PhoneInputValue = z.infer<typeof phoneSchema>;

export { calculateAge };
