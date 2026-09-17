import { z } from "zod";

import { CONTACT_FORM_LIMITS } from "@/lib/config/contact";

const OPTIONAL_PHONE = /^$|^\+[1-9]\d{6,14}$/;

export const contactSubmissionSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Enter your first name.")
    .max(CONTACT_FORM_LIMITS.nameMax),
  lastName: z
    .string()
    .trim()
    .min(1, "Enter your last name.")
    .max(CONTACT_FORM_LIMITS.nameMax),
  email: z
    .email("Enter a valid email address.")
    .max(CONTACT_FORM_LIMITS.emailMax),
  phone: z.object({
    e164: z
      .string()
      .regex(OPTIONAL_PHONE, "Enter a complete mobile number or leave it blank."),
    countryIso2: z.string().length(2).toUpperCase(),
  }),
  message: z
    .string()
    .trim()
    .min(CONTACT_FORM_LIMITS.messageMin, "Tell us a little more about your enquiry.")
    .max(CONTACT_FORM_LIMITS.messageMax, "Your message is too long."),
  termsAccepted: z.literal(true, {
    error: "Please accept the Legal, Privacy & Marketing Terms to send your message.",
  }),
  website: z.string().max(0).optional(),
});

export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;
