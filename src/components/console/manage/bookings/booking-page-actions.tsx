"use client";

import { z } from "zod";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRightIcon,
  CalendarClockIcon,
  ChevronDownIcon,
  ClockPlusIcon,
  ReceiptTextIcon,
  type LucideIcon,
} from "lucide-react";

import {
  checkManagedExtension,
  extendManagedBooking,
  moveManagedBooking,
  rescheduleManagedBooking,
} from "@/app/(console)/manage/bookings/actions";
import { Button } from "@/components/shared/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExtendBookingDialog } from "@/components/console/shared/booking/extend-booking-dialog";
import { MoveBookingDialog } from "@/components/console/shared/booking/move-booking-dialog";
import { RescheduleBookingDialog } from "@/components/console/shared/booking/reschedule-booking-dialog";
import type {
  MoveBookingSuite,
  RescheduleTimes,
  RescheduleTimesRequest,
} from "@/components/console/shared/booking/booking-dialog-types";
import type { BookingActionGates } from "@/components/console/manage/bookings/booking-model";
import type { BookingStatus } from "@/lib/domain/booking";

const rescheduleTimesSchema = z.object({
  status: z.enum(["open", "closed", "hours_unconfigured", "error", "invalid", "rate_limited"]),
  slots: z
    .array(
      z.object({
        startsAt: z.string(),
        label: z.string(),
        disabled: z.boolean(),
        message: z.string().nullable(),
        kind: z.enum(["available", "secured", "unavailable"]),
      }),
    )
    .optional(),
});

async function loadManagedTimes(request: RescheduleTimesRequest): Promise<RescheduleTimes> {
  const query = new URLSearchParams({
    date: request.date,
    durationMinutes: String(request.durationMinutes),
  });
  try {
    const response = await fetch(
      `/api/console/bookings/${encodeURIComponent(request.bookingId)}/reschedule-times?${query.toString()}`,
      { cache: "no-store" },
    );
    const parsed = rescheduleTimesSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      console.error("[bookings] reschedule times could not be read:", response.status);
      return { status: "error" };
    }
    return parsed.data;
  } catch (cause) {
    console.error("[bookings] reschedule times request failed:", cause instanceof Error ? cause.message : cause);
    return { status: "error" };
  }
}

export interface BookingPageSubject {
  readonly id: string;
  readonly reference: string;
  readonly status: BookingStatus;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly suiteId: string | null;
  readonly suiteNumber: number | null;
  readonly guestName: string;
}

export interface BookingPageSettings {
  readonly defaultExtensionMinutes: number;
  readonly maxHorizonDays: number | null;
  readonly durationsHours: readonly number[];
}

export interface BookingPageActionsProps {
  booking: BookingPageSubject;
  gates: BookingActionGates;
  suites: readonly MoveBookingSuite[];
  settings: BookingPageSettings;
  receiptHref: string;
}

type OpenDialog = "reschedule" | "extend" | "move";

const CHANGE_SUITE_COPY = {
  title: "Change suite",
  submit: "Change suite",
  pending: "Changing…",
  success: "Suite changed",
  failure: "Suite could not be changed",
} as const;

interface ManageItemProps {
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly reason: string | null;
  readonly onSelect: () => void;
}

function ManageItem({ label, Icon, reason, onSelect }: ManageItemProps) {
  return (
    <DropdownMenuItem disabled={reason !== null} onSelect={onSelect} className="min-h-tap items-start py-2">
      <Icon aria-hidden="true" className="mt-0.5" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span>{label}</span>
        {reason !== null && <span className="text-micro text-pretty text-text-muted">{reason}</span>}
      </span>
    </DropdownMenuItem>
  );
}

export function BookingPageActions({ booking, gates, suites, settings, receiptHref }: BookingPageActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<OpenDialog | null>(null);
  const durationMs = Date.parse(booking.endsAt) - Date.parse(booking.startsAt);
  const openChange = (dialog: OpenDialog) => (next: boolean) => setOpen(next ? dialog : null);

  return (
    <>
      <Button asChild variant="outline">
        <Link href={receiptHref}>
          <ReceiptTextIcon aria-hidden="true" className="size-4" />
          Receipt
        </Link>
      </Button>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button">
            Manage
            <ChevronDownIcon aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <ManageItem
            label="Reschedule"
            Icon={CalendarClockIcon}
            reason={gates.reschedule}
            onSelect={() => setOpen("reschedule")}
          />
          <ManageItem label="Extend visit" Icon={ClockPlusIcon} reason={gates.extend} onSelect={() => setOpen("extend")} />
          <ManageItem
            label="Change suite"
            Icon={ArrowLeftRightIcon}
            reason={gates.changeSuite}
            onSelect={() => setOpen("move")}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {open === "reschedule" && gates.reschedule === null && (
        <RescheduleBookingDialog
          booking={booking}
          durationsHours={settings.durationsHours}
          maxHorizonDays={settings.maxHorizonDays}
          loadTimes={loadManagedTimes}
          onSubmit={rescheduleManagedBooking}
          open
          onOpenChange={openChange("reschedule")}
        />
      )}

      {gates.extend === null && (
        <ExtendBookingDialog
          bookingId={booking.id}
          open={open === "extend"}
          onOpenChange={openChange("extend")}
          defaultExtensionMinutes={settings.defaultExtensionMinutes}
          onSubmit={extendManagedBooking}
          onCheck={checkManagedExtension}
          endsAt={booking.endsAt}
        />
      )}

      {open === "move" && gates.changeSuite === null && booking.suiteId !== null && (
        <MoveBookingDialog
          bookingId={booking.id}
          who={booking.guestName || booking.reference}
          suites={suites}
          current={{ suiteId: booking.suiteId, startsAt: booking.startsAt, endsAt: booking.endsAt }}
          currentSuiteNumber={booking.suiteNumber}
          durationMs={durationMs}
          initial={{ suiteId: booking.suiteId, startsAt: booking.startsAt }}
          copy={CHANGE_SUITE_COPY}
          onSubmit={moveManagedBooking}
          onClose={() => setOpen(null)}
          onMoved={() => router.refresh()}
        />
      )}
    </>
  );
}
