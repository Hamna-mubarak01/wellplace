import type { EmailFooterDesign } from "@/lib/domain/email/footer";
import type { EmailHeaderDesign } from "@/lib/domain/email/header";
import type { SystemMessageKey } from "@/lib/config/message-documents";
import { loadPublishedMessage } from "@/lib/db/message-templates-send";
import { fetchMessageDocument } from "@/lib/db/queries/message-documents";
import type { WellPlaceClient } from "@/lib/db/types";
import type { VariableValues } from "@/lib/domain/email/document";
import { authoredEmail } from "@/lib/messaging/templates/authored";
import type { EmailMessage } from "@/lib/messaging/types";
import { parseStoredDocument } from "@/lib/validation/message-document";

export interface AuthoredMessageOptions {
  readonly to?: string | readonly string[];
  readonly client?: WellPlaceClient;
}

export interface ResolvedTemplate {
  readonly footer?: string | null;
  readonly footerDesign?: EmailFooterDesign | null;
  readonly headerDesign?: EmailHeaderDesign | null;
  readonly stored: ReturnType<typeof parseStoredDocument>;
  readonly isActive: boolean;
  readonly readFailed: boolean;
}

async function readTemplate(
  key: SystemMessageKey,
  client: WellPlaceClient | undefined,
): Promise<ResolvedTemplate> {
  try {
    if (client === undefined) {
      const published = await loadPublishedMessage(key);
      if (!published.ok) {
        console.error(`[messages] ${key} wording could not be read: ${published.message}`);
        return { stored: null, isActive: true, readFailed: true };
      }
      if (published.template === null) {
        return { stored: null, isActive: true, readFailed: false };
      }

      return {
        stored: parseStoredDocument(published.template.document),
        footer: published.template.footer,
        footerDesign: published.template.footerDesign,
        headerDesign: published.template.headerDesign,
        isActive: published.template.isActive,
        readFailed: false,
      };
    }

    const found = await fetchMessageDocument(client, key);
    if (!found.ok) {
      console.error(`[messages] ${key} wording could not be read: ${found.message}`);
      return { stored: null, isActive: true, readFailed: true };
    }
    if (found.template === null) return { stored: null, isActive: true, readFailed: false };

    return {
      stored: parseStoredDocument(found.template.document),
      footer: found.template.footer,
      footerDesign: found.template.footerDesign,
      headerDesign: found.template.headerDesign,
      isActive: found.template.isActive,
      readFailed: false,
    };
  } catch (cause) {
    console.error(
      `[messages] ${key} wording could not be read:`,
      cause instanceof Error ? cause.message : cause,
    );
    return { stored: null, isActive: true, readFailed: true };
  }
}

export async function authoredMessage(
  key: SystemMessageKey,
  values: VariableValues,
  options: AuthoredMessageOptions = {},
): Promise<EmailMessage | null> {
  const template = await readTemplate(key, options.client);

  if (template.readFailed) {
    console.error(
      `[messages] ${key} is being sent with the built-in wording because its saved wording could not be read; whether it is switched off is unknown`,
    );
  }

  if (!template.isActive) {
    console.info(`[messages] ${key} is switched off, nothing sent`);
    return null;
  }

  return authoredEmail({ key, footer: template.footer, footerDesign: template.footerDesign, headerDesign: template.headerDesign, stored: template.stored, values, to: options.to });
}
