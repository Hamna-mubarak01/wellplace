"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STAFF_INPUT_LIMITS } from "@/lib/config/staff-access";

import { headers } from "next/headers";

import { requireManagement } from "@/lib/auth/session";
import {
  deleteAuthUser,
  ensureAuthUser,
  findAuthUserByEmail,
  findStaffAccount,
  revokeStaffSessions,
  sendStaffInvite,
} from "@/lib/services/staff-access-service";
import { createClient } from "@/lib/db/server";
import { findInvitationById } from "@/lib/db/queries/staff";
import {
  deleteStaffMember,
  INVITATION_ALREADY_ACCEPTED,
  INVITATION_REVOKED,
  inviteStaffMember,
  resendStaffInvitation,
  revokeStaffInvitation,
  setStaffActive,
  setStaffRole,
  STAFF_LAST_MANAGEMENT,
  STAFF_SELF_DELETE,
} from "@/lib/db/rpc";

export type StaffActionResult = { ok: true } | { ok: false; message: string };

const roleSchema = z.enum(["reception", "management"]);

const inviteSchema = z.object({
  email: z.email("Enter a valid email address.").max(STAFF_INPUT_LIMITS.email, `Keep the email address to ${STAFF_INPUT_LIMITS.email} characters or fewer.`),
  fullName: z.string().trim().min(1, "Enter their full name.").max(STAFF_INPUT_LIMITS.name),
  role: roleSchema,
});

function explain(code: string | null, fallback: string): string {
  if (code === "42501") return "You do not have permission for that.";
  if (code === "23505") return "That address already has console access.";
  if (code === "P0002") return "That record no longer exists.";
  return fallback;
}

export async function inviteMember(raw: unknown): Promise<StaffActionResult> {
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const actor = await requireManagement();
  const supabase = await createClient();

  const email = parsed.data.email.trim().toLowerCase();

  const result = await inviteStaffMember(supabase, {
    email,
    fullName: parsed.data.fullName,
    role: parsed.data.role,
  });

  if (!result.ok) {
    console.error("[console] invite failed:", result.message);
    return {
      ok: false,
      message: explain(result.code, "The invitation was not created."),
    };
  }

  const account = await ensureAuthUser(email);
  if ("error" in account) {
    console.error("[console] could not provision the account:", account.error);
    return {
      ok: false,
      message:
        "The invitation was recorded, but we could not create their account. Try inviting them again.",
    };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";

  const mail = await sendStaffInvite({
    email,
    fullName: parsed.data.fullName,
    role: parsed.data.role,
    invitedByName: actor.fullName,
    origin: host ? `${proto}://${host}` : undefined,
  });

  revalidatePath("/manage/staff");

  if (!mail.ok) {
    return {
      ok: false,
      message:
        mail.reason === "switched_off"
          ? "They were added, but no invitation was sent: the console invitation email is switched off. Switch it back on under Message templates, then send the invite again."
          : "They were added, but the invitation email did not send. Try sending the invite again.",
    };
  }

  return { ok: true };
}

export async function revokeInvitation(raw: {
  invitationId: string;
}): Promise<StaffActionResult> {
  const parsed = z.object({ invitationId: z.uuid() }).safeParse(raw);
  if (!parsed.success)
    return { ok: false, message: "That invitation is not valid." };

  await requireManagement();
  const supabase = await createClient();

  const invitation = await findInvitationById(
    supabase,
    parsed.data.invitationId,
  );

  const result = await revokeStaffInvitation(
    supabase,
    parsed.data.invitationId,
    "Revoked from the console",
  );

  if (!result.ok) {
    console.error("[console] revoke failed:", result.message);
    return {
      ok: false,
      message: explain(result.code, "The invitation was not revoked."),
    };
  }

  revalidatePath("/manage/staff");

  const stillLive =
    "Their invitation was revoked, but we could not confirm their emailed link " +
    "was disabled — it may still work. Delete the account in Supabase to be sure.";

  if (!invitation) {
    console.error(
      "[console] revoked an invitation we could not read back:",
      parsed.data.invitationId,
    );
    return { ok: false, message: stillLive };
  }

  const existing = await findStaffAccount(invitation.email);

  if (existing.outcome === "failed") {
    console.error("[console] revoke — staff lookup failed:", existing.message);
    return { ok: false, message: stillLive };
  }

  if (existing.outcome === "found") return { ok: true };

  const account = await findAuthUserByEmail(invitation.email);
  if (!account.ok) {
    console.error("[console] revoke — auth lookup failed:", account.message);
    return { ok: false, message: stillLive };
  }

  if (!account.userId) return { ok: true };

  const removed = await deleteAuthUser(account.userId);
  if (!removed.ok) return { ok: false, message: stillLive };

  return { ok: true };
}

export async function resendInvitation(raw: {
  invitationId: string;
}): Promise<StaffActionResult> {
  const parsed = z.object({ invitationId: z.uuid() }).safeParse(raw);
  if (!parsed.success)
    return { ok: false, message: "That invitation is not valid." };

  const actor = await requireManagement();
  const supabase = await createClient();

  const result = await resendStaffInvitation(
    supabase,
    parsed.data.invitationId,
    "Resent from the console",
  );

  if (result.outcome === "failed") {
    console.error("[console] resend_staff_invitation failed:", result.message);

    if (result.code === INVITATION_ALREADY_ACCEPTED) {
      return {
        ok: false,
        message:
          "They have already signed in, so there is nothing to resend. If they cannot get in, ask them to use “Forgot your password?”.",
      };
    }
    if (result.code === INVITATION_REVOKED) {
      return {
        ok: false,
        message:
          "That invitation was revoked. Invite them again to give them access.",
      };
    }

    return {
      ok: false,
      message: explain(result.code, "The invitation was not resent."),
    };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";

  const mail = await sendStaffInvite({
    email: result.email,
    fullName: result.fullName,
    role: result.role,
    invitedByName: actor.fullName,
    origin: host ? `${proto}://${host}` : undefined,
  });

  revalidatePath("/manage/staff");

  if (!mail.ok) {
    return {
      ok: false,
      message:
        "The invitation was refreshed, but the email did not send. Try again.",
    };
  }

  return { ok: true };
}

export async function changeMemberAccess(raw: {
  staffId: string;
  isActive: boolean;
}): Promise<StaffActionResult> {
  const parsed = z
    .object({ staffId: z.uuid(), isActive: z.boolean() })
    .safeParse(raw);
  if (!parsed.success)
    return { ok: false, message: "That staff member is not valid." };

  await requireManagement();
  const supabase = await createClient();

  const result = await setStaffActive(
    supabase,
    parsed.data.staffId,
    parsed.data.isActive,
    parsed.data.isActive
      ? "Reactivated from the console"
      : "Deactivated from the console",
  );

  if (!result.ok) {
    console.error("[console] set_staff_active failed:", result.message);

    if (result.code === STAFF_LAST_MANAGEMENT) {
      return {
        ok: false,
        message:
          "This is the last Management account. Give someone else Management access first, or nobody will be able to manage the console.",
      };
    }

    return {
      ok: false,
      message: explain(result.code, "Access was not changed."),
    };
  }

  if (!parsed.data.isActive) {
    await revokeStaffSessions(parsed.data.staffId);
  }

  revalidatePath("/manage/staff");
  return { ok: true };
}

export async function deleteMember(raw: {
  staffId: string;
  reason?: string;
}): Promise<StaffActionResult> {
  const parsed = z
    .object({
      staffId: z.uuid(),
      reason: z.string().trim().max(500).optional(),
    })
    .safeParse(raw);
  if (!parsed.success)
    return { ok: false, message: "That staff member is not valid." };

  await requireManagement();
  const supabase = await createClient();

  const result = await deleteStaffMember(
    supabase,
    parsed.data.staffId,
    parsed.data.reason?.length
      ? parsed.data.reason
      : "Deleted from the console",
  );

  if (result.outcome === "failed") {
    console.error("[console] delete_staff_member failed:", result.message);

    if (result.code === STAFF_SELF_DELETE) {
      return {
        ok: false,
        message:
          "You cannot delete your own account. Ask another manager to do it.",
      };
    }
    if (result.code === STAFF_LAST_MANAGEMENT) {
      return {
        ok: false,
        message:
          "This is the last Management account. Give someone else Management access first, or nobody will be able to manage the console.",
      };
    }

    return {
      ok: false,
      message: explain(result.code, "They were not deleted."),
    };
  }

  const account = await deleteAuthUser(result.staffId);

  revalidatePath("/manage/staff");

  if (!account.ok) {
    return {
      ok: false,
      message: `${result.fullName} was removed from the console, but their sign-in could not be deleted. They cannot reach anything, but delete the account in Supabase to finish.`,
    };
  }

  return { ok: true };
}

export async function changeMemberRole(raw: {
  staffId: string;
  role: "reception" | "management";
}): Promise<StaffActionResult> {
  const parsed = z
    .object({ staffId: z.uuid(), role: roleSchema })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, message: "That role is not valid." };

  await requireManagement();
  const supabase = await createClient();

  const result = await setStaffRole(
    supabase,
    parsed.data.staffId,
    parsed.data.role,
    "Role changed from the console",
  );

  if (!result.ok) {
    console.error("[console] set_staff_role failed:", result.message);
    return {
      ok: false,
      message: explain(result.code, "The role was not changed."),
    };
  }

  revalidatePath("/manage/staff");
  return { ok: true };
}

