import type { Database } from "@/types/database.generated";

export type NamedPermission = Database["public"]["Enums"]["named_permission"];
export type StaffRole = Database["public"]["Enums"]["staff_role"];

export const ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly NamedPermission[]>> = {
  reception: ["override_suite_allocation", "correct_customer_record"],
  management: [
    "view_confidential_figures",
    "override_suite_allocation",
    "manual_price_change",
    "correct_customer_record",
  ],
};

export function heldByRole(
  permission: NamedPermission,
  role: StaffRole,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const PERMISSION_LABEL: Readonly<Record<NamedPermission, string>> = {
  view_confidential_figures: "See confidential figures",
  override_suite_allocation: "Override suite allocation",
  manual_price_change: "Change a price manually",
  correct_customer_record: "Correct a customer record",
};

export function permissionLabel(permission: NamedPermission): string {
  return PERMISSION_LABEL[permission];
}
