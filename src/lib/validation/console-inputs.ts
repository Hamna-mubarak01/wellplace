import { z } from "zod";
import { CONSOLE_MONEY_AED } from "@/lib/config/console-limits";

export const idSchema = z.uuid("That record could not be identified.");

export const instantSchema = z.iso.datetime({
  offset: true,
  message: "That is not a valid date and time.",
});

export const filsSchema = z
  .int("Enter an amount in whole fils.")
  .nonnegative("An amount cannot be negative.")
  .max(CONSOLE_MONEY_AED.max * 100, `Enter an amount no greater than AED ${CONSOLE_MONEY_AED.max.toLocaleString("en-US")}.`);

export const positiveFilsSchema = filsSchema.positive("Enter an amount above zero.");

export const minutesSchema = z
  .int("Enter a whole number of minutes.")
  .nonnegative("Minutes cannot be negative.")
  .max(1440, "That is longer than a day.");

export const shortTextSchema = z.string().trim().max(300);

export const noteSchema = z.string().trim().max(2000);
