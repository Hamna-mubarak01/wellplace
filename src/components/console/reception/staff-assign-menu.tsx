"use client";

import { CheckIcon, UserPlusIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface StaffOption {
  readonly id: string;
  readonly fullName: string;
}

export interface StaffAssignMenuProps {
  staff: readonly StaffOption[];
  assignedTo: string | null;
  triggerLabel: string;
  menuLabel: string;
  disabled?: boolean;
  unassignLabel?: string;
  onAssign: (staffId: string) => void;
  onUnassign?: () => void;
}

export function StaffAssignMenu({
  staff,
  assignedTo,
  triggerLabel,
  menuLabel,
  disabled = false,
  unassignLabel,
  onAssign,
  onUnassign,
}: StaffAssignMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          hoverEffect="sweep"
          type="button"
          variant="outline"
          size="sm"
          className="min-h-tap"
          disabled={disabled}
        >
          <UserPlusIcon aria-hidden="true" className="size-4" />
          {triggerLabel}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>

        {staff.length === 0 ? (
          <DropdownMenuItem disabled className="min-h-tap whitespace-nowrap">
            No colleague has an account yet
          </DropdownMenuItem>
        ) : (
          staff.map((member) => (
            <DropdownMenuItem
              key={member.id}
              disabled={member.id === assignedTo}
              className="min-h-tap whitespace-nowrap"
              onSelect={() => onAssign(member.id)}
            >
              {member.id === assignedTo ? (
                <CheckIcon aria-hidden="true" className="size-4" />
              ) : null}
              <span className="truncate">{member.fullName}</span>
            </DropdownMenuItem>
          ))
        )}

        {onUnassign && unassignLabel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={assignedTo === null}
              className="min-h-tap whitespace-nowrap"
              onSelect={() => onUnassign()}
            >
              {unassignLabel}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
