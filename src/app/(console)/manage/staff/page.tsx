import type { Metadata } from "next";
import {
  ConciergeBellIcon,
  MailCheckIcon,
  ShieldIcon,
  UserRoundXIcon,
  UsersRoundIcon,
} from "lucide-react";

import { requireManagement } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  listOpenInvitations,
  listStaffWithPermissions,
} from "@/lib/db/queries/staff";
import { InviteMemberDialog } from "@/components/console/invite-member-dialog";
import { InvitationsList } from "@/components/console/invitations-list";
import { StaffExportButton } from "@/components/console/staff-export-button";
import { StaffTable } from "@/components/console/staff-table";
import { ConsolePage } from "@/components/console/console-page";
import { DetailSection } from "@/components/console/shared/detail-section";
import { FilterBar } from "@/components/console/shared/filter-bar";
import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import {
  filterStaff,
  hasStaffFilters,
  parseStaffAccessFilter,
  parseStaffRoleFilter,
} from "@/lib/console/staff-filters";
import { staffHref } from "@/app/(console)/manage/staff/staff-view";

export const metadata: Metadata = {
  title: "Staff",
  robots: { index: false, follow: false },
};

const ROLE_OPTIONS = [
  { value: "management", label: "Management" },
  { value: "reception", label: "Reception" },
] as const;

const ACCESS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "deactivated", label: "Deactivated" },
] as const;

function activeCount(count: number): string {
  return `${count.toLocaleString("en-AE")} active`;
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; access?: string }>;
}) {
  const session = await requireManagement();
  const { q, role: rawRole, access: rawAccess } = await searchParams;

  const search = q?.trim() ?? "";
  const role = parseStaffRoleFilter(rawRole);
  const access = parseStaffAccessFilter(rawAccess);

  const supabase = await createClient();
  const [memberListing, invitationListing] = await Promise.all([
    listStaffWithPermissions(supabase),
    listOpenInvitations(supabase),
  ]);

  if (!memberListing.ok || !invitationListing.ok) {
    return (
      <ConsolePage title="Staff">
        <ConsoleReadError
          title="Staff records could not be loaded"
          message={
            !memberListing.ok
              ? memberListing.message
              : !invitationListing.ok
                ? invitationListing.message
                : "Reload this page to try again."
          }
        />
      </ConsolePage>
    );
  }

  const members = memberListing.items;
  const invitations = invitationListing.items;

  const filters = { search, role, access };
  const visible = filterStaff(members, filters);
  const filtered = hasStaffFilters(filters);

  const managers = members.filter((member) => member.role === "management");
  const receptionists = members.filter((member) => member.role === "reception");
  const active = members.filter((member) => member.isActive).length;
  const expired = invitations.filter((invitation) => invitation.isExpired).length;

  return (
    <ConsolePage
      title="Staff"
      actions={
        <>
          {members.length > 1 && <StaffExportButton total={visible.length} />}
          <InviteMemberDialog />
        </>
      }
    >
      <StatGrid columns={5} label="Staff summary">
        <StatCard
          label="Console access"
          value={members.length}
          sub={activeCount(active)}
          Icon={UsersRoundIcon}
          href={staffHref(filters, { role: null, access: null })}
        />
        <StatCard
          label="Management"
          value={managers.length}
          sub={activeCount(managers.filter((member) => member.isActive).length)}
          Icon={ShieldIcon}
          href={staffHref(filters, { role: role === "management" ? null : "management" })}
          selected={role === "management"}
        />
        <StatCard
          label="Reception"
          value={receptionists.length}
          sub={activeCount(receptionists.filter((member) => member.isActive).length)}
          Icon={ConciergeBellIcon}
          href={staffHref(filters, { role: role === "reception" ? null : "reception" })}
          selected={role === "reception"}
        />
        <StatCard
          label="Deactivated"
          value={members.length - active}
          sub="Cannot sign in"
          Icon={UserRoundXIcon}
          href={staffHref(filters, { access: access === "deactivated" ? null : "deactivated" })}
          selected={access === "deactivated"}
        />
        <StatCard
          label="Invitations"
          value={invitations.length}
          sub={expired > 0 ? `${expired.toLocaleString("en-AE")} expired` : "Not yet signed in"}
          tone={expired > 0 ? "warning" : "neutral"}
          Icon={MailCheckIcon}
          href={invitations.length > 0 ? "#invitations" : undefined}
        />
      </StatGrid>

      <InvitationsList invitations={invitations} />

      <DetailSection
        title="Console access"
        Icon={UsersRoundIcon}
        count={visible.length}
        id="console-access"
      >
        <div className="flex min-w-0 flex-col gap-4">
          {members.length > 1 && (
            <FilterBar
              label="Filter staff"
              search={{
                label: "Search staff by name or email",
                placeholder: "Name or email",
                value: search,
              }}
              selects={[
                {
                  param: "role",
                  label: "Role",
                  allLabel: "Any role",
                  value: role === "any" ? null : role,
                  options: ROLE_OPTIONS,
                },
                {
                  param: "access",
                  label: "Access",
                  allLabel: "Any access",
                  value: access === "any" ? null : access,
                  options: ACCESS_OPTIONS,
                },
              ]}
              resultsLabel={`${visible.length.toLocaleString("en-AE")} of ${members.length.toLocaleString("en-AE")} staff shown`}
            />
          )}

          <StaffTable
            members={visible}
            currentUserId={session.userId}
            filtered={filtered}
          />
        </div>
      </DetailSection>
    </ConsolePage>
  );
}
