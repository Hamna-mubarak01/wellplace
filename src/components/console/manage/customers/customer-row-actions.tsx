"use client";

import Link from "next/link";
import { useState } from "react";
import { EllipsisVerticalIcon, EyeIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { customerHref } from "@/app/(console)/manage/customers/customers-query";
import { CustomerDeleteDialog } from "@/components/console/manage/customers/customer-delete-dialog";
import { CustomerFormDialog } from "@/components/console/manage/customers/customer-form-dialog";
import { Button } from "@/components/shared/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ManagementCustomer } from "@/lib/db/queries/management-customers";

export interface CustomerRowActionsProps {
  readonly customer: ManagementCustomer;
  readonly canEdit: boolean;
}

export function CustomerRowActions({ customer, canEdit }: CustomerRowActionsProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const name = customer.fullName.trim() === "" ? "this customer" : customer.fullName.trim();

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
            <EllipsisVerticalIcon aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem asChild className="min-h-tap">
            <Link href={customerHref(customer.id)}>
              <EyeIcon aria-hidden="true" />
              View
            </Link>
          </DropdownMenuItem>
          {canEdit && (
            <>
              <DropdownMenuItem className="min-h-tap" onSelect={() => setEditing(true)}>
                <PencilIcon aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" className="min-h-tap" onSelect={() => setDeleting(true)}>
                <Trash2Icon aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canEdit && <CustomerFormDialog customer={customer} open={editing} onOpenChange={setEditing} />}
      {canEdit && (
        <CustomerDeleteDialog customer={{ id: customer.id, name }} open={deleting} onOpenChange={setDeleting} />
      )}
    </>
  );
}
