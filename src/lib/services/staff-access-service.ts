import { inviteLinkLifetimeLabel } from "@/lib/config/staff-access";
import { adminAuthRequest, createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { findStaffByEmail, type StaffLookup } from "@/lib/db/queries/staff";
import { emailAdapter } from "@/lib/messaging/mailer";
import type { EmailAdapter } from "@/lib/messaging/types";
import { authoredMessage } from "@/lib/services/message-document-service";

export type StaffRoleLabel = "management" | "reception";

const ROLE_LABEL: Readonly<Record<StaffRoleLabel, string>> = {
  management: "Management",
  reception: "Reception",
};

export type AccessMailOutcome =
  | { ok: true }
  | { ok: false; reason: "link_failed" | "send_failed" | "switched_off"; message: string };

function adapter(): EmailAdapter {
  return emailAdapter();
}

function siteOrigin(explicit?: string): string {
  const base =
    explicit ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

async function recoveryLink(
  email: string,
  origin: string,
): Promise<{ url: string } | { error: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/set-password` },
  });

  if (error) return { error: error.message };

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) return { error: "Supabase returned no token" };

  const url = new URL(`${origin}/auth/confirm`);
  url.searchParams.set("token", tokenHash);

  return { url: url.toString() };
}

export async function revokeStaffSessions(
  userId: string,
): Promise<{ ok: boolean }> {
  try {
    const response = await adminAuthRequest(`/admin/users/${userId}/logout`, {
      method: "POST",
    });

    if (!response.ok) {
      console.error(
        "[staff] could not end sessions for",
        userId,
        "-",
        response.status,
        await response.text().catch(() => ""),
      );
      return { ok: false };
    }

    return { ok: true };
  } catch (cause) {
    console.error("[staff] session revocation threw for", userId, cause);
    return { ok: false };
  }
}

export async function deleteAuthUser(
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { error } = await createAdminClient().auth.admin.deleteUser(userId);

    if (error) {
      console.error("[staff] auth user not deleted:", userId, "-", error.message);
      return { ok: false, message: error.message };
    }

    return { ok: true };
  } catch (cause) {
    console.error("[staff] auth user deletion threw for", userId, cause);
    return { ok: false, message: "The account could not be reached." };
  }
}

export async function findStaffAccount(email: string): Promise<StaffLookup> {
  return findStaffByEmail(createAdminClient(), email);
}

export async function findAuthUserByEmail(
  email: string,
): Promise<{ ok: true; userId: string | null } | { ok: false; message: string }> {
  const admin = createAdminClient();
  const needle = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page++) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) return { ok: false, message: listed.error.message };

    const match = listed.data.users.find(
      (user) => user.email?.toLowerCase() === needle,
    );
    if (match) return { ok: true, userId: match.id };
    if (listed.data.users.length < 200) break;
  }

  return { ok: true, userId: null };
}

export async function ensureAuthUser(
  email: string,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (!error && data.user) return { id: data.user.id };

  const existing = await findAuthUserByEmail(email);
  if (existing.ok && existing.userId) return { id: existing.userId };
  if (!existing.ok) return { error: existing.message };

  return { error: error?.message ?? "Could not find or create that account" };
}

export async function sendStaffInvite(input: {
  email: string;
  fullName: string;
  role: StaffRoleLabel;
  invitedByName: string | null;
  origin?: string;
}): Promise<AccessMailOutcome> {
  const link = await recoveryLink(input.email, siteOrigin(input.origin));
  if ("error" in link) {
    console.error("[staff] invite link failed:", link.error);
    return { ok: false, reason: "link_failed", message: link.error };
  }

  const message = await authoredMessage(
    "staff_invitation",
    {
      full_name: input.fullName,
      email: input.email,
      role: ROLE_LABEL[input.role],
      invited_by: input.invitedByName ?? "A colleague",
      action_url: link.url,
      link_lifetime: inviteLinkLifetimeLabel(),
    },
    { to: input.email, client: await createClient() },
  );

  if (message === null) {
    console.error("[staff] invite email is switched off, nothing sent");
    return {
      ok: false,
      reason: "switched_off",
      message: "The console invitation email is switched off in Message templates.",
    };
  }

  const result = await adapter().send(message);

  if (!result.ok) {
    console.error("[staff] invite email not sent:", result.message);
    return { ok: false, reason: "send_failed", message: result.message };
  }

  return { ok: true };
}

export async function sendPasswordReset(input: {
  email: string;
  fullName: string | null;
  origin?: string;
}): Promise<AccessMailOutcome> {
  const link = await recoveryLink(input.email, siteOrigin(input.origin));
  if ("error" in link) {
    console.error("[staff] reset link failed:", link.error);
    return { ok: false, reason: "link_failed", message: link.error };
  }

  const message = await authoredMessage(
    "staff_password_reset",
    {
      full_name: input.fullName ?? "there",
      email: input.email,
      action_url: link.url,
      link_lifetime: inviteLinkLifetimeLabel(),
    },
    { to: input.email },
  );

  if (message === null) {
    console.error("[staff] reset email is switched off, nothing sent");
    return {
      ok: false,
      reason: "switched_off",
      message: "The console password reset email is switched off in Message templates.",
    };
  }

  const result = await adapter().send(message);

  if (!result.ok) {
    console.error("[staff] reset email not sent:", result.message);
    return { ok: false, reason: "send_failed", message: result.message };
  }

  return { ok: true };
}
