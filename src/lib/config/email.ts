import { z } from "zod";

import { DEFAULT_SOCIAL_URLS } from "@/lib/config/social-links";

const address = z.email("expected a single email address");

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

const schema = z.object({
  guestFrom: address.default("hello@wellplace.example"),

  guestFromName: z.string().trim().min(1).max(78).default("WellPlace – Wellness Made Private"),

  operationsFrom: address.default("waitlist@wellplace.example"),

  operationsFromName: z.string().trim().min(1).max(78).default("WellPlace notifications"),

  operationsTo: z
    .string()
    .default("hello@wellplace.example")
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(address)
        .nonempty("at least one operations recipient is required")
        .max(10, "too many operations recipients — this is a mailbox list, not a campaign"),
    ),

  assetBaseUrl: z
    .url()
    .refine((value) => value.startsWith("https://") || LOCAL_ORIGIN.test(value), {
      message:
        "email assets must be served over https, or from localhost when running the demo locally",
    })
    .default("http://localhost:3000"),

  consoleUrl: z.url().default("http://localhost:3000/manage/waitlist"),

  instagramUrl: z.url().default(DEFAULT_SOCIAL_URLS.instagram),
  tiktokUrl: z.url().default(DEFAULT_SOCIAL_URLS.tiktok),
});

const QUOTED = /[()<>@,;:\\".\[\]]/;

export function formatSender(name: string | undefined, address: string): string {
  if (!name) return address;
  const clean = name.replace(/[\r\n"\\]/g, "").trim();
  if (!clean) return address;
  return `${QUOTED.test(clean) ? `"${clean}"` : clean} <${address}>`;
}

export type EmailConfig = z.infer<typeof schema>;

let cached: EmailConfig | null = null;

export function emailConfig(): EmailConfig {
  if (cached) return cached;

  const parsed = schema.safeParse({
    guestFrom: process.env.EMAIL_GUEST_FROM || undefined,
    guestFromName: process.env.EMAIL_GUEST_FROM_NAME || undefined,
    operationsFrom: process.env.EMAIL_OPERATIONS_FROM || undefined,
    operationsFromName: process.env.EMAIL_OPERATIONS_FROM_NAME || undefined,
    operationsTo: process.env.EMAIL_OPERATIONS_TO || undefined,
    assetBaseUrl: process.env.EMAIL_ASSET_BASE_URL || undefined,
    consoleUrl: process.env.EMAIL_CONSOLE_URL || undefined,
    instagramUrl: process.env.SOCIAL_INSTAGRAM_URL || undefined,
    tiktokUrl: process.env.SOCIAL_TIKTOK_URL || undefined,
  });

  if (!parsed.success) {
    throw new Error(
      `Email configuration is invalid: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")} — ${issue.message}`)
        .join("; ")}`,
    );
  }

  cached = parsed.data;
  return cached;
}

export function resetEmailConfigCache(): void {
  cached = null;
}
