import { z } from "zod";
import { MESSAGE_HEADER_LIMITS as L } from "@/lib/config/message-header";
import { HEADER_LOGOS, isHeaderImageUrl } from "@/lib/domain/email/header";

export const messageHeaderDesignSchema = z
  .object({
    logo: z.enum(HEADER_LOGOS),
    logoSrc: z.string().trim().max(L.hrefMax),
    logoAlt: z.string().trim().max(L.altMax),
    logoWidth: z
      .number()
      .int("Use a whole number of pixels for the logo width.")
      .min(L.logoWidthMin, `Make the logo at least ${L.logoWidthMin} pixels wide.`)
      .max(L.logoWidthMax, `Keep the logo within ${L.logoWidthMax} pixels wide.`),
    text: z.string().max(L.textMax, `Keep the header wording within ${L.textMax} characters.`),
    align: z.enum(["left", "center", "right"]),
  })
  .refine((design) => design.logo !== "custom" || isHeaderImageUrl(design.logoSrc), {
    message: "Upload a logo image, or choose the WellPlace logo.",
    path: ["logoSrc"],
  });
