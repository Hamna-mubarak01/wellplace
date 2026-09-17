import { z } from "zod";
import { MESSAGE_FOOTER_LIMITS as L } from "@/lib/config/message-footer";
import { FOOTER_ICONS, isFooterHref } from "@/lib/domain/email/footer";

export const messageFooterDesignSchema = z.object({
  label: z.string().max(L.labelMax),
  align: z.enum(["left", "center", "right"]),
  iconStyle: z.enum(["brand", "coloured", "monochrome"]),
  divider: z.boolean(),
  links: z.array(z.object({
    id: z.string().min(1).max(64),
    icon: z.enum(FOOTER_ICONS),
    label: z.string().trim().min(1, "Give this link a label.").max(L.labelMax),
    href: z.string().trim().max(L.hrefMax).refine((value) => value === "" || isFooterHref(value), "Use a valid https://, mailto: or tel: link."),
    enabled: z.boolean(),
  }).refine((link) => !link.enabled || link.href !== "", { message: "Add a link or switch this icon off.", path: ["href"] })).max(L.linksMax),
}).refine((design) => new Set(design.links.map((link) => link.id)).size === design.links.length, "Each footer link must have a unique ID.");
