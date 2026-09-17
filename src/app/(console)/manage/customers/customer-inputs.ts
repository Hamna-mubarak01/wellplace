import { z } from "zod";

import { CONSOLE_LIST } from "@/lib/config/console-list";
import { todayInDubai } from "@/lib/domain/time";
import { idSchema } from "@/lib/validation/console-inputs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const E164 = /^\+[1-9][0-9]{6,14}$/;
const COUNTRY = /^[A-Z]{2}$/;

function name(label: string) {
  return z
    .string()
    .trim()
    .min(1, `Enter a ${label}.`)
    .max(CONSOLE_LIST.customerNameMax, `Keep the ${label} to ${CONSOLE_LIST.customerNameMax} characters or fewer.`);
}

const recordFields = {
  salutation: z.enum(["mr", "ms"]).nullable(),
  firstName: name("first name"),
  lastName: name("last name"),
  dateOfBirth: z
    .string()
    .regex(ISO_DATE, "Choose the day, month and year of birth.")
    .refine((value) => value > "1900-01-01" && value <= todayInDubai(new Date()), "Choose a real date of birth.")
    .nullable(),
  phoneE164: z.string().trim().regex(E164, "Enter a valid mobile number."),
  phoneCountry: z.string().trim().regex(COUNTRY, "Choose the mobile number's country."),
  internalNote: z
    .string()
    .trim()
    .max(CONSOLE_LIST.customerNoteMax, `Keep the note to ${CONSOLE_LIST.customerNoteMax} characters or fewer.`)
    .transform((value) => (value === "" ? null : value)),
};

export const createCustomerSchema = z.object({
  ...recordFields,
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
});

export const updateCustomerSchema = z.object({
  ...recordFields,
  customerId: idSchema,
});

export const deleteCustomerSchema = z.object({ customerId: idSchema });

export type CustomerFormField = keyof typeof recordFields | "email";
