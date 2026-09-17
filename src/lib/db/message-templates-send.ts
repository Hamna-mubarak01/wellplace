import type { EmailFooterDesign } from "@/lib/domain/email/footer";
import { messageFooterDesignSchema } from "@/lib/validation/message-footer";
import type { EmailHeaderDesign } from "@/lib/domain/email/header";
import { messageHeaderDesignSchema } from "@/lib/validation/message-header";
import { z } from "zod";
import { createAdminClient } from "@/lib/db/admin";
import type { SystemMessageKey } from "@/lib/config/message-documents";
import type { Json } from "@/types/database.generated";

const sendRowSchema = z.object({
  footer: z.string().nullable().optional(),
  footer_design: messageFooterDesignSchema.nullish(),
  header_design: messageHeaderDesignSchema.nullish(),
  subject: z.string().nullable(),
  preheader: z.string().nullable(),
  document: z.unknown().nullable(),
  is_active: z.boolean(),
  is_marketing: z.boolean(),
});

export interface PublishedMessage {
  footer?: string | null;
  footerDesign?: EmailFooterDesign | null;
  headerDesign?: EmailHeaderDesign | null;
  subject: string | null;
  preheader: string | null;
  document: Json | null;
  isActive: boolean;
  isMarketing: boolean;
}

export type PublishedMessageRead =
  | { ok: true; template: PublishedMessage | null }
  | { ok: false; message: string };

export async function loadPublishedMessage(
  key: SystemMessageKey,
): Promise<PublishedMessageRead> {
  try {
    const client = createAdminClient();
    const { data, error } = await client.rpc("message_document_for_send", { p_key: key });
    if (error) return { ok: false, message: error.message };

    const rows = z.array(sendRowSchema).safeParse(data ?? []);
    if (!rows.success) {
      return { ok: false, message: "The published wording has an unexpected format." };
    }

    const row = rows.data[0];
    if (row === undefined) return { ok: true, template: null };

    return {
      ok: true,
      template: {
        footer: row.footer,
        footerDesign: row.footer_design,
        headerDesign: row.header_design,
        subject: row.subject,
        preheader: row.preheader,
        document: (row.document ?? null) as Json | null,
        isActive: row.is_active,
        isMarketing: row.is_marketing,
      },
    };
  } catch (cause) {
    console.error("[messaging] the published wording could not be read:", cause);
    return { ok: false, message: "The published wording could not be loaded." };
  }
}
