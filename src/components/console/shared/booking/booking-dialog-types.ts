import type { SuiteStatus } from "@/lib/db/queries/board";
import type { BookingStatus } from "@/lib/domain/booking";

export type BookingDialogResult = { ok: true } | { ok: false; message: string };

export interface ExtendBookingRequest {
  readonly bookingId: string;
  readonly extraMinutes: number;
  readonly reason: string;
}

export type ExtensionCheck =
  | { readonly status: "fits"; readonly freeUntil: string | null }
  | { readonly status: "conflict"; readonly freeUntil: string | null; readonly message: string }
  | { readonly status: "error"; readonly message: string };

export interface ExtensionCheckRequest {
  readonly bookingId: string;
  readonly extraMinutes: number;
}

export interface RescheduleBookingRequest {
  readonly bookingId: string;
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly reason: string;
}

export interface RescheduleTimesRequest {
  readonly bookingId: string;
  readonly date: string;
  readonly durationMinutes: number;
}

export type RescheduleTimesStatus =
  | "open"
  | "closed"
  | "hours_unconfigured"
  | "error"
  | "invalid"
  | "rate_limited";

export interface RescheduleTimeSlot {
  readonly startsAt: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly message: string | null;
  readonly kind: "available" | "secured" | "unavailable";
}

export interface RescheduleTimes {
  readonly status: RescheduleTimesStatus;
  readonly slots?: readonly RescheduleTimeSlot[];
}

export interface RescheduleBookingSubject {
  readonly id: string;
  readonly status: BookingStatus;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly suiteNumber: number | null;
}

export interface MoveBookingRequest {
  readonly bookingId: string;
  readonly suiteId: string;
  readonly startsAt: string;
  readonly reason: string;
}

export interface MoveBookingSuite {
  readonly id: string;
  readonly suiteNumber: number;
  readonly status: SuiteStatus;
  readonly isCurrent?: boolean;
  readonly isAvailable?: boolean;
}

export interface MoveBookingPlacement {
  readonly suiteId: string;
  readonly startsAt: string;
}

export interface BookingDetailsRequest {
  readonly bookingId: string;
  readonly personalRequest: string;
  readonly internalNote: string;
  readonly reason: string;
}
