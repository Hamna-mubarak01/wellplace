import type { EmailFooterDesign } from "@/lib/domain/email/footer";
import type { EmailHeaderDesign } from "@/lib/domain/email/header";
import { DEFAULT_FOOTER_DESIGN } from "@/lib/config/message-footer";
import type { SystemMessageKey } from "@/lib/config/message-documents";

const GUEST_FOOTER: Readonly<
  Partial<Record<SystemMessageKey, readonly string[]>>
> = {
  waitlist_confirmation: [
    "Need to update your details or leave the waitlist? Simply reply to this email.",
    "WellPlace · Dubai, United Arab Emirates",
    "You are receiving this email because you joined the WellPlace waitlist.",
  ],
  contact_acknowledgement: [
    "Need to add anything? Simply reply to this email.",
    "WellPlace · Dubai, United Arab Emirates",
    "You are receiving this email because you sent a message through wellplace.example.",
  ],
};

const BOOKING_FOOTER: readonly string[] = [
  "Questions about your booking? Simply reply to this email.",
  "WellPlace · Dubai, United Arab Emirates",
  "You are receiving this email because you made a booking with WellPlace.",
];

const STAFF_FOOTER: Readonly<
  Partial<Record<SystemMessageKey, readonly string[]>>
> = {
  staff_invitation: [
    "WellPlace console · this invitation was sent to staff only.",
    "If you were not expecting it, ignore this email and nothing happens.",
  ],
  staff_password_reset: [
    "WellPlace console · this message was sent to staff only.",
    "If you did not ask for this, ignore it — your current password still works.",
  ],
  waitlist_signup_notification: [
    "WellPlace operations · this notification is sent to staff only.",
  ],
  contact_notification: [
    "WellPlace operations · this notification is sent to staff only.",
  ],
};

export function footerFor(key: SystemMessageKey, footer?: string | null): readonly string[] {
  if (footer != null) return footer.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return GUEST_FOOTER[key] ?? STAFF_FOOTER[key] ?? BOOKING_FOOTER;
}

export const SOCIAL_KEYS: readonly SystemMessageKey[] = [
  "waitlist_confirmation",
  "contact_acknowledgement",
];

export interface MessageEmailFrame {
  readonly headerDesign?: EmailHeaderDesign;
  readonly footerDesign?: EmailFooterDesign;
  readonly assetBaseUrl: string;
  readonly footerLines: readonly string[];
  readonly social?: {
    readonly label: string;
    readonly items: readonly { name: string; href: string; icon: string }[];
  };
}

export function messageEmailFrame(
  key: SystemMessageKey,
  config: { assetBaseUrl: string; instagramUrl: string; tiktokUrl: string },
  footer?: string | null,
  footerDesign?: EmailFooterDesign | null,
  headerDesign?: EmailHeaderDesign | null,
): MessageEmailFrame {
  return {
    headerDesign: headerDesign ?? undefined,
    footerDesign: footerDesign ?? undefined,
    assetBaseUrl: config.assetBaseUrl,
    footerLines: footerFor(key, footer),
    social: SOCIAL_KEYS.includes(key)
      ? {
          label: "Follow the WellPlace journey:",
          items: [
            { name: "Instagram", href: config.instagramUrl, icon: "instagram" },
            { name: "TikTok", href: config.tiktokUrl, icon: "tiktok" },
          ],
        }
      : undefined,
  };
}

export function editableFooterDesign(frame?: MessageEmailFrame): EmailFooterDesign {
  return frame?.footerDesign ?? {
    ...DEFAULT_FOOTER_DESIGN,
    label: frame?.social?.label ?? "",
    links: (frame?.social?.items ?? []).map((item, index) => ({
      id: `footer-${index}`, icon: item.icon === "tiktok" ? "tiktok" : "instagram",
      label: item.name, href: item.href, enabled: true,
    })),
  };
}
