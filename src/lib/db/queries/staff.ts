import type { WellPlaceClient } from "@/lib/db/types";
import type { Database } from "@/types/database.generated";

type StaffListing<T> = { ok: true; items: T[] } | { ok: false; message: string };

export type StaffRole = Database["public"]["Enums"]["staff_role"];
export type NamedPermission = Database["public"]["Enums"]["named_permission"];

export interface StaffRow {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
}

export interface InvitationRow {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  invitedAt: string;
  expiresAt: string;
  isExpired: boolean;
}

export async function findStaffWithPermissions(
  client: WellPlaceClient,
  id: string,
): Promise<(StaffRow & { permissions: NamedPermission[] }) | null> {
  const { data, error } = await client.from("staff")
    .select("id, email, full_name, role, is_active, created_at, staff_permissions!staff_permissions_staff_id_fkey(permission)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`This account's access could not be read: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id, email: data.email, fullName: data.full_name,
    role: data.role, isActive: data.is_active, createdAt: data.created_at,
    permissions: data.staff_permissions.map((grant) => grant.permission),
  };
}

export async function findStaffById(
  client: WellPlaceClient,
  id: string,
): Promise<StaffRow | null> {
  const { data, error } = await client
    .from("staff")
    .select("id, email, full_name, role, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[db] findStaffById failed:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role,
    isActive: data.is_active,
    createdAt: data.created_at,
  };
}

export async function listStaff(client: WellPlaceClient): Promise<StaffListing<StaffRow>> {
  const { data, error } = await client
    .from("staff")
    .select("id, email, full_name, role, is_active, created_at")
    .order("is_active", { ascending: false })
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[db] listStaff failed:", error.message);
    return { ok: false, message: "Staff records could not be loaded. Reload the page before assigning work or changing access." };
  }

  return { ok: true, items: (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  })) };
}

export async function listStaffWithPermissions(
  client: WellPlaceClient,
): Promise<StaffListing<StaffRow & { permissions: NamedPermission[] }>> {
  const { data, error } = await client.from("staff")
    .select("id, email, full_name, role, is_active, created_at, staff_permissions!staff_permissions_staff_id_fkey(permission)")
    .order("is_active", { ascending: false })
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[db] listStaffWithPermissions failed:", error.message);
    return { ok: false, message: "Staff records and permissions could not be loaded. Reload the page before changing access." };
  }

  return { ok: true, items: (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    permissions: row.staff_permissions.map((grant) => grant.permission),
  })) };
}

export async function listOpenInvitations(
  client: WellPlaceClient,
): Promise<StaffListing<InvitationRow>> {
  const { data, error } = await client
    .from("staff_invitations")
    .select("id, email, full_name, role, invited_at, expires_at")
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("expires_at", { ascending: true });

  if (error) {
    console.error("[db] listOpenInvitations failed:", error.message);
    return { ok: false, message: "Staff invitations could not be loaded. Reload the page before sending another invitation." };
  }

  const now = Date.now();

  return { ok: true, items: (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    invitedAt: row.invited_at,
    expiresAt: row.expires_at,
    isExpired: new Date(row.expires_at).getTime() <= now,
  })) };
}

export async function findInvitationById(
  client: WellPlaceClient,
  id: string,
): Promise<InvitationRow | null> {
  const { data, error } = await client
    .from("staff_invitations")
    .select("id, email, full_name, role, invited_at, expires_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[db] findInvitationById failed:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role,
    invitedAt: data.invited_at,
    expiresAt: data.expires_at,
    isExpired: new Date(data.expires_at).getTime() <= Date.now(),
  };
}

export type StaffLookup =
  | { outcome: "found"; staff: StaffRow }
  | { outcome: "absent" }
  | { outcome: "failed"; message: string };

export async function findStaffByEmail(
  client: WellPlaceClient,
  email: string,
): Promise<StaffLookup> {
  const { data, error } = await client
    .from("staff")
    .select("id, email, full_name, role, is_active, created_at")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) {
    const detail = error.message || error.details || error.hint || "unknown error";
    console.error("[db] findStaffByEmail failed:", detail);
    return { outcome: "failed", message: detail };
  }
  if (!data) return { outcome: "absent" };

  return {
    outcome: "found",
    staff: {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      isActive: data.is_active,
      createdAt: data.created_at,
    },
  };
}

export async function listStaffPermissions(
  client: WellPlaceClient,
  staffId: string,
): Promise<NamedPermission[]> {
  const { data, error } = await client
    .from("staff_permissions")
    .select("permission")
    .eq("staff_id", staffId);

  if (error) {
    throw new Error(
      `The permissions on this account could not be read: ${error.message}`,
    );
  }

  return (data ?? []).map((row) => row.permission);
}
