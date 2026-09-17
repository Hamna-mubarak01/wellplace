"use client";

import Link from "next/link";
import { CalendarDaysIcon, EllipsisVerticalIcon, UserRoundIcon } from "lucide-react";

import { ConfirmRefundDialog } from "@/components/console/manage/confirm-refund-dialog";
import { canConfirmReturn, canWithdraw } from "@/components/console/manage/finance/finance-labels";
import { WithdrawRefundDialog } from "@/components/console/reception/withdraw-refund-dialog";
import { Button } from "@/components/shared/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { managedBookingPath, managedCustomerPath } from "@/lib/config/finance";
import type { RefundLedgerRow } from "@/lib/db/queries/management-refunds";

export function RefundRowActions({ row }: { row: RefundLedgerRow }) {
  return (
    <div className="flex items-center justify-end gap-2">
      {canConfirmReturn(row) && <ConfirmRefundDialog refundId={row.id} amountFils={row.amountFils} />}
      {canWithdraw(row) && <WithdrawRefundDialog bookingId={row.bookingId} refundId={row.id} amountFils={row.amountFils} />}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Actions for refund ${row.reference}`}>
            <EllipsisVerticalIcon aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem asChild className="min-h-tap">
            <Link href={managedBookingPath(row.bookingId)}>
              <CalendarDaysIcon aria-hidden="true" />
              Open booking {row.bookingReference}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-tap">
            <Link href={managedCustomerPath(row.customerId)}>
              <UserRoundIcon aria-hidden="true" />
              Open customer
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
