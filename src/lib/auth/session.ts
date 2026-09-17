import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/server";
import {
  heldByRole,
} from "@/lib/config/permissions";
import type { ConsoleId } from "@/lib/auth/console";
import type { WellPlaceClient } from "@/lib/db/types";
import { claimStaffInvitation } from "@/lib/db/rpc";
import { findStaffWithPermissions } from "@/lib/db/queries/staff";
import type { Database } from "@/types/database.generated";

export type StaffRole = Database["public"]["Enums"]["staff_role"];
export type NamedPermission = Database["public"]["Enums"]["named_permission"];

export interface StaffSession {
  userId: string;
  email: string;
  fullName: string;
  role: StaffRole;
  permissions: readonly NamedPermission[];
}

export const SIGN_IN_PATH = "/sign-in";
export const NO_ACCESS_PATH = "/no-access";

export function noAccessPath(consoleId: ConsoleId): string {
  return `${NO_ACCESS_PATH}?console=${consoleId}`;
}

export async function claimInvitationIfAny(
  client?: WellPlaceClient,
): Promise<void> {
  const supabase = client ?? (await createClient());

  const { error } = await claimStaffInvitation(supabase);
  if (error) {
    console.error("[console] claim_staff_invitation failed:", error.message);
  }
}

const readAuthUser = cache(async (): Promise<{ id: string; email?: string } | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { id: user.id, email: user.email } : null;
});

export const readStaffSession = cache(async (): Promise<StaffSession | null> => {
  const user = await readAuthUser();
  if (!user?.email) return null;

  const supabase = await createClient();

  const staff = await findStaffWithPermissions(supabase, user.id);
  if (!staff || !staff.isActive) return null;

  return {
    userId: staff.id,
    email: staff.email,
    fullName: staff.fullName,
    role: staff.role,
    permissions: staff.permissions,
  };
});

export async function requireStaff(): Promise<StaffSession> {
  if ((await readAuthUser()) === null) redirect(SIGN_IN_PATH);

  const session = await readStaffSession();
  if (!session) redirect(NO_ACCESS_PATH);
  return session;
}

export async function requireManagement(): Promise<StaffSession> {
  const session = await requireStaff();
  if (session.role !== "management") redirect(noAccessPath("manage"));
  return session;
}

export async function requireReception(): Promise<StaffSession> {
  const session = await requireStaff();
  if (session.role !== "reception") redirect(noAccessPath("reception"));
  return session;
}

export function hasPermission(
  session: StaffSession,
  permission: NamedPermission,
): boolean {
  return heldByRole(permission, session.role);
}

