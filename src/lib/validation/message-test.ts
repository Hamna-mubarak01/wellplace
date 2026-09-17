import { z } from "zod";

export const testRecipientSchema = z
  .string()
  .trim()
  .pipe(z.email("Enter one valid email address to receive the test."));
