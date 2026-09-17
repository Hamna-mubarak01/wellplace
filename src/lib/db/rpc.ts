import type { EmailFooterDesign } from "@/lib/domain/email/footer";
import type { EmailHeaderDesign } from "@/lib/domain/email/header";
import { z } from "zod";
import { ACTION_UNCONFIRMED, databaseErrorMessage } from "@/lib/domain/action-errors";

import type { OverrunRateSource } from "@/lib/domain/overrun";
import { invoiceRowSchema, toInvoice, type Invoice } from "@/lib/db/invoice-record";
import { SUITE_STATUSES } from "@/lib/config/suite-status";
import type { SystemMessageKey } from "@/lib/config/message-documents";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Database, Json } from "@/types/database.generated";

export type Salutation = "mr" | "ms";

export type WaitlistSubmissionInput = {
  salutation: Salutation;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  phoneE164: string;
  phoneCountry: string;
  source?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  isSpam?: boolean;
  termsText: string;
  termsVersion: string;
};

export type WaitlistSubmissionResult =
  | { outcome: "created"; entryId: string; submittedAt: string }
  | { outcome: "already_registered" }
  | { outcome: "failed"; message: string; code: string | null };

const submissionRowSchema = z.object({
  status: z.enum(["created", "already_registered"]),
  entry_id: z.uuid().nullable(),
  submitted_at: z.string().nullable(),
});

export async function submitWaitlistEntry(
  client: WellPlaceClient,
  input: WaitlistSubmissionInput,
): Promise<WaitlistSubmissionResult> {
  const { data, error } = await client.rpc("submit_waitlist_entry", {
    p_salutation: input.salutation,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
    p_date_of_birth: input.dateOfBirth,
    p_phone_e164: input.phoneE164,
    p_phone_country: input.phoneCountry,
    p_source: input.source ?? undefined,
    p_referrer: input.referrer ?? undefined,
    p_utm_source: input.utmSource ?? undefined,
    p_utm_medium: input.utmMedium ?? undefined,
    p_utm_campaign: input.utmCampaign ?? undefined,
    p_utm_content: input.utmContent ?? undefined,
    p_utm_term: input.utmTerm ?? undefined,
    p_is_spam: input.isSpam ?? false,
    p_terms_text: input.termsText,
    p_terms_version: input.termsVersion,
  });

  if (error) {
    return { outcome: "failed", message: databaseErrorMessage(error), code: error.code ?? null };
  }

  const parsed = submissionRowSchema.safeParse(data);
  if (!parsed.success) {
    return {
      outcome: "failed",
      message: ACTION_UNCONFIRMED,
      code: null,
    };
  }

  if (parsed.data.status === "already_registered") {
    return { outcome: "already_registered" };
  }

  if (parsed.data.entry_id === null || parsed.data.submitted_at === null) {
    return {
      outcome: "failed",
      message: "submit_waitlist_entry reported a new entry without returning it.",
      code: null,
    };
  }

  return {
    outcome: "created",
    entryId: parsed.data.entry_id,
    submittedAt: parsed.data.submitted_at,
  };
}

export type ManualWaitlistEntryInput = {
  salutation: Salutation;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  phoneE164: string;
  phoneCountry: string;
  reason?: string | null;
};

export type ManualWaitlistEntryResult =
  | { outcome: "created"; entryId: string; submittedAt: string }
  | { outcome: "already_registered"; entryId: string | null; submittedAt: string | null }
  | { outcome: "failed"; message: string; code: string | null };

export async function createWaitlistEntryManual(
  client: WellPlaceClient,
  input: ManualWaitlistEntryInput,
): Promise<ManualWaitlistEntryResult> {
  const { data, error } = await client.rpc("create_waitlist_entry_manual", {
    p_salutation: input.salutation,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
    p_date_of_birth: input.dateOfBirth,
    p_phone_e164: input.phoneE164,
    p_phone_country: input.phoneCountry,
    p_reason: input.reason ?? undefined,
  });

  if (error) {
    return { outcome: "failed", message: databaseErrorMessage(error), code: error.code ?? null };
  }

  const parsed = submissionRowSchema.safeParse(data);
  if (!parsed.success) {
    return {
      outcome: "failed",
      message: ACTION_UNCONFIRMED,
      code: null,
    };
  }

  if (parsed.data.status === "already_registered") {
    return {
      outcome: "already_registered",
      entryId: parsed.data.entry_id,
      submittedAt: parsed.data.submitted_at,
    };
  }

  if (parsed.data.entry_id === null || parsed.data.submitted_at === null) {
    return {
      outcome: "failed",
      message: "create_waitlist_entry_manual reported a new entry without returning it.",
      code: null,
    };
  }

  return {
    outcome: "created",
    entryId: parsed.data.entry_id,
    submittedAt: parsed.data.submitted_at,
  };
}

export type ConsoleActionResult =
  | { ok: true }
  | { ok: false; message: string; code: string | null };

async function callConsoleRpc(
  run: () => PromiseLike<{ error: { message: string; code?: string } | null }>,
): Promise<ConsoleActionResult> {
  const { error } = await run();
  if (error) {
    return { ok: false, message: databaseErrorMessage(error), code: error.code ?? null };
  }
  return { ok: true };
}

export function claimStaffInvitation(client: WellPlaceClient) {
  return client.rpc("claim_staff_invitation");
}

export function archiveWaitlistEntry(
  client: WellPlaceClient,
  entryId: string,
  reason: string | null,
): Promise<ConsoleActionResult> {
  return callConsoleRpc(() =>
    client.rpc("archive_waitlist_entry", { p_entry_id: entryId, p_reason: reason ?? undefined }),
  );
}

export function restoreWaitlistEntry(
  client: WellPlaceClient,
  entryId: string,
  reason: string | null,
): Promise<ConsoleActionResult> {
  return callConsoleRpc(() =>
    client.rpc("restore_waitlist_entry", { p_entry_id: entryId, p_reason: reason ?? undefined }),
  );
}

export function eraseWaitlistEntry(
  client: WellPlaceClient,
  entryId: string,
  reason: string | null,
): Promise<ConsoleActionResult> {
  return callConsoleRpc(() =>
    client.rpc("erase_waitlist_entry", { p_entry_id: entryId, p_reason: reason ?? undefined }),
  );
}

export function inviteStaffMember(
  client: WellPlaceClient,
  input: { email: string; fullName: string; role: "reception" | "management" },
): Promise<ConsoleActionResult> {
  return callConsoleRpc(() =>
    client.rpc("invite_staff_member", {
      p_email: input.email,
      p_full_name: input.fullName,
      p_role: input.role,
    }),
  );
}

export function revokeStaffInvitation(
  client: WellPlaceClient,
  invitationId: string,
  reason: string | null,
): Promise<ConsoleActionResult> {
  return callConsoleRpc(() =>
    client.rpc("revoke_staff_invitation", {
      p_invitation_id: invitationId,
      p_reason: reason ?? undefined,
    }),
  );
}

export function setStaffActive(
  client: WellPlaceClient,
  staffId: string,
  isActive: boolean,
  reason: string | null,
): Promise<ConsoleActionResult> {
  return callConsoleRpc(() =>
    client.rpc("set_staff_active", {
      p_staff_id: staffId,
      p_is_active: isActive,
      p_reason: reason ?? undefined,
    }),
  );
}

export function setStaffRole(
  client: WellPlaceClient,
  staffId: string,
  role: "reception" | "management",
  reason: string | null,
): Promise<ConsoleActionResult> {
  return callConsoleRpc(() =>
    client.rpc("set_staff_role", {
      p_staff_id: staffId,
      p_role: role,
      p_reason: reason ?? undefined,
    }),
  );
}

export const STAFF_SELF_DELETE = "WP001";
export const STAFF_LAST_MANAGEMENT = "WP002";

export type DeleteStaffMemberResult =
  | {
      outcome: "deleted";
      staffId: string;
      email: string;
      fullName: string;
      role: "reception" | "management";
      wasActive: boolean;
      invitationsRevoked: number;
      deletedAt: string;
    }
  | { outcome: "failed"; message: string; code: string | null };

const staffDeletionRowSchema = z.object({
  staff_id: z.uuid(),
  email: z.string(),
  full_name: z.string(),
  role: z.enum(["reception", "management"]),
  was_active: z.boolean(),
  invitations_revoked: z.number().int(),
  deleted_at: z.string(),
});

export async function deleteStaffMember(
  client: WellPlaceClient,
  staffId: string,
  reason: string | null,
): Promise<DeleteStaffMemberResult> {
  const { data, error } = await client.rpc("delete_staff_member", {
    p_staff_id: staffId,
    p_reason: reason ?? undefined,
  });

  if (error) {
    return { outcome: "failed", message: databaseErrorMessage(error), code: error.code ?? null };
  }

  const parsed = staffDeletionRowSchema.safeParse(data);
  if (!parsed.success) {
    return {
      outcome: "failed",
      message: ACTION_UNCONFIRMED,
      code: null,
    };
  }

  return {
    outcome: "deleted",
    staffId: parsed.data.staff_id,
    email: parsed.data.email,
    fullName: parsed.data.full_name,
    role: parsed.data.role,
    wasActive: parsed.data.was_active,
    invitationsRevoked: parsed.data.invitations_revoked,
    deletedAt: parsed.data.deleted_at,
  };
}

export const INVITATION_ALREADY_ACCEPTED = "WP003";
export const INVITATION_REVOKED = "WP004";

export type ResendStaffInvitationResult =
  | {
      outcome: "resent";
      invitationId: string;
      email: string;
      fullName: string;
      role: "reception" | "management";
      expiresAt: string;
      resendCount: number;
      lastResentAt: string;
      wasExpired: boolean;
    }
  | { outcome: "failed"; message: string; code: string | null };

const staffInvitationResendRowSchema = z.object({
  invitation_id: z.uuid(),
  email: z.string(),
  full_name: z.string(),
  role: z.enum(["reception", "management"]),
  expires_at: z.string(),
  resend_count: z.number().int(),
  last_resent_at: z.string(),
  was_expired: z.boolean(),
});

export async function resendStaffInvitation(
  client: WellPlaceClient,
  invitationId: string,
  reason: string | null,
): Promise<ResendStaffInvitationResult> {
  const { data, error } = await client.rpc("resend_staff_invitation", {
    p_invitation_id: invitationId,
    p_reason: reason ?? undefined,
  });

  if (error) {
    return { outcome: "failed", message: databaseErrorMessage(error), code: error.code ?? null };
  }

  const parsed = staffInvitationResendRowSchema.safeParse(data);
  if (!parsed.success) {
    return {
      outcome: "failed",
      message: ACTION_UNCONFIRMED,
      code: null,
    };
  }

  return {
    outcome: "resent",
    invitationId: parsed.data.invitation_id,
    email: parsed.data.email,
    fullName: parsed.data.full_name,
    role: parsed.data.role,
    expiresAt: parsed.data.expires_at,
    resendCount: parsed.data.resend_count,
    lastResentAt: parsed.data.last_resent_at,
    wasExpired: parsed.data.was_expired,
  };
}

const availabilityRowSchema = z.object({
  starts_at: z.string(),
  remaining: z.number().int().nonnegative(),
  reduced_by_demand: z.boolean(),
});

export interface SlotAvailability {
  startsAt: string;
  remaining: number;
  reducedByDemand: boolean;
}

export type AvailabilityResult =
  | { ok: true; slots: SlotAvailability[] }
  | { ok: false; message: string };

export async function countAvailableSuites(
  client: WellPlaceClient,
  input: {
    startsAt: readonly string[];
    durationHours: number;
    bufferMinutes: number;
    rescheduleBookingId?: string;
  },
): Promise<AvailabilityResult> {
  if (input.startsAt.length === 0) return { ok: true, slots: [] };

  const { data, error } = input.rescheduleBookingId ? await client.rpc("count_reschedule_suites", {
    p_booking_id: input.rescheduleBookingId,
    p_starts_at: [...input.startsAt],
    p_duration_minutes: Math.round(input.durationHours * 60),
  }) : await client.rpc("count_available_suites", {
    p_starts_at: [...input.startsAt],
    p_duration_hours: input.durationHours,
    p_buffer_minutes: input.bufferMinutes,
  });

  if (error) return { ok: false, message: databaseErrorMessage(error) };

  const parsed = z.array(availabilityRowSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, message: "Available times could not be loaded. Check your connection and try again." };
  }

  return {
    ok: true,
    slots: parsed.data.map((row) => ({
      startsAt: row.starts_at,
      remaining: row.remaining,
      reducedByDemand: row.reduced_by_demand,
    })),
  };
}

export const HOLD_DURATION_OUT_OF_RANGE = "WP005";
export const HOLD_BUFFER_OUT_OF_RANGE = "WP006";
export const HOLD_MINUTES_OUT_OF_RANGE = "WP007";
export const HOLD_STAFF_INACTIVE = "WP008";

const holdRowSchema = z.object({
  occupancy_id: z.string(),
  suite_id: z.string(),
  expires_at: z.string(),
});

export interface SuiteHold {
  occupancyId: string;
  suiteId: string;
  expiresAt: string;
}

export type HoldSuiteResult =
  | { outcome: "held"; hold: SuiteHold }
  | { outcome: "no_suite" }
  | { outcome: "failed"; code: string | null; message: string };

export async function holdSuite(
  client: WellPlaceClient,
  input: {
    startsAt: string;
    durationHours: number;
    bufferMinutes: number;
    holdMinutes: number;
  },
): Promise<HoldSuiteResult> {
  const { data, error } = await client.rpc("hold_suite", {
    p_starts_at: input.startsAt,
    p_duration_hours: input.durationHours,
    p_buffer_minutes: input.bufferMinutes,
    p_hold_minutes: input.holdMinutes,
  });

  if (error) {
    return { outcome: "failed", code: error.code ?? null, message: databaseErrorMessage(error) };
  }

  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return { outcome: "no_suite" };

  const parsed = holdRowSchema.safeParse(rows[0]);
  if (!parsed.success) {
    return {
      outcome: "failed",
      code: null,
      message: ACTION_UNCONFIRMED,
    };
  }

  return {
    outcome: "held",
    hold: {
      occupancyId: parsed.data.occupancy_id,
      suiteId: parsed.data.suite_id,
      expiresAt: parsed.data.expires_at,
    },
  };
}

export const RECEPTION_NO_SUITE = "WP010";
export const RECEPTION_GUEST_RULES = "WP011";
export const RECEPTION_CUSTOMER_BLOCKED = "WP012";
export const RECEPTION_CUSTOMER_MISMATCH = "WP062";
export const RECEPTION_TERMS_REQUIRED = "WP063";
export const RECEPTION_OVERRIDE_REQUIRED = "WP013";
export const RECEPTION_ADDON_QUANTITY = "WP037";
export const RECEPTION_ADDON_UNAVAILABLE = "WP038";
export const RECEPTION_VOUCHER_INVALID = "WP039";
export const RECEPTION_VOUCHER_USED_UP = "WP040";
export const RECEPTION_VOUCHER_CUSTOMER_LIMIT = "WP041";
export const RECEPTION_VOUCHER_NO_TARGET = "WP042";
export const RECEPTION_ILLEGAL_TRANSITION = "WP014";
export const RECEPTION_EXTENSION_BLOCKED = "WP015";
export const RECEPTION_RESCHEDULE_FAILED = "WP016";
export const RECEPTION_CUSTOMER_CORRECTION_REQUIRED = "WP018";
export const RECEPTION_TASK_FINISHED = "WP020";
export const RECEPTION_TEMPLATE_INACTIVE = "WP021";
export const RECEPTION_MESSAGE_CANCELLED = "WP022";
export const RECEPTION_SHIFT_ALREADY_HANDED_OVER = "WP024";
export const RECEPTION_PAYMENT_NOT_VOIDABLE = "WP028";
export const RECEPTION_BUFFER_OVERRIDE_REQUIRED = "WP035";
export const MANAGEMENT_UNKNOWN_SETTING = "WP048";
export const MANAGEMENT_SETTING_TYPE_MISMATCH = "WP049";
export const MANAGEMENT_SUITE_PRIORITY_INVALID = "WP050";
export const MANAGEMENT_PERMISSION_ALREADY_HELD = "WP051";
export const MANAGEMENT_PERMISSION_NOT_HELD = "WP052";
export const MANAGEMENT_STAFF_INACTIVE = "WP053";
export const RECEPTION_DURATION_CONFLICT = "WP054";
export const RECEPTION_OVERRUN_RATE_INVALID = "WP055";
export const RECEPTION_OVERRUN_NO_GUESTS = "WP056";
export const RECEPTION_DESK_OPERATOR_REQUIRED = "WP057";
export const MANAGEMENT_SUITE_HAS_UPCOMING = "WP072";
export const MANAGEMENT_SUITE_HAS_HISTORY = "WP073";
export const MANAGEMENT_SUITE_RETIRED = "WP074";
export const MANAGEMENT_SUITE_IN_SERVICE = "WP075";
export const MANAGEMENT_INVOICE_SETTINGS_INCOMPLETE = "WP076";
export const MANAGEMENT_INVOICE_COMPLIMENTARY = "WP077";
export const MANAGEMENT_INVOICE_NOTHING_PAID = "WP078";
export const MANAGEMENT_INVOICE_VOIDED = "WP079";
export const MANAGEMENT_TEMPLATE_NOTHING_TO_RESET = "WP082";
export const MANAGEMENT_TEMPLATE_NO_DRAFT = "WP083";
export const MANAGEMENT_TEMPLATE_DRAFT_NEEDS_DOCUMENT = "WP084";
export const MANAGEMENT_INVOICE_HAS_CREDIT_NOTES = "WP085";
export const MANAGEMENT_INVOICE_EARLIER_INVOICE_GAP = "WP086";
export const MANAGEMENT_CUSTOMER_EMAIL_TAKEN = "WP087";
export const MANAGEMENT_CUSTOMER_HAS_HISTORY = "WP088";

const REFUSAL_CODES = new Set([
  MANAGEMENT_CUSTOMER_EMAIL_TAKEN,
  MANAGEMENT_CUSTOMER_HAS_HISTORY,
  MANAGEMENT_INVOICE_HAS_CREDIT_NOTES,
  MANAGEMENT_INVOICE_EARLIER_INVOICE_GAP,
  MANAGEMENT_TEMPLATE_NOTHING_TO_RESET,
  MANAGEMENT_TEMPLATE_NO_DRAFT,
  MANAGEMENT_TEMPLATE_DRAFT_NEEDS_DOCUMENT,
  MANAGEMENT_SUITE_HAS_UPCOMING,
  MANAGEMENT_SUITE_HAS_HISTORY,
  MANAGEMENT_SUITE_RETIRED,
  MANAGEMENT_SUITE_IN_SERVICE,
  MANAGEMENT_INVOICE_SETTINGS_INCOMPLETE,
  MANAGEMENT_INVOICE_COMPLIMENTARY,
  MANAGEMENT_INVOICE_NOTHING_PAID,
  MANAGEMENT_INVOICE_VOIDED,
  "WP068",
  "WP069",
  "WP070",
  RECEPTION_CUSTOMER_MISMATCH,
  RECEPTION_TERMS_REQUIRED,
  RECEPTION_DESK_OPERATOR_REQUIRED,
  "WP058", "WP059", "WP060",
  RECEPTION_ADDON_QUANTITY,
  RECEPTION_ADDON_UNAVAILABLE,
  RECEPTION_VOUCHER_INVALID,
  RECEPTION_VOUCHER_USED_UP,
  RECEPTION_VOUCHER_CUSTOMER_LIMIT,
  RECEPTION_VOUCHER_NO_TARGET,
  RECEPTION_GUEST_RULES,
  RECEPTION_CUSTOMER_BLOCKED,
  RECEPTION_OVERRIDE_REQUIRED,
  RECEPTION_ILLEGAL_TRANSITION,
  RECEPTION_EXTENSION_BLOCKED,
  RECEPTION_RESCHEDULE_FAILED,
  RECEPTION_CUSTOMER_CORRECTION_REQUIRED,
  RECEPTION_TASK_FINISHED,
  RECEPTION_TEMPLATE_INACTIVE,
  RECEPTION_MESSAGE_CANCELLED,
  RECEPTION_SHIFT_ALREADY_HANDED_OVER,
  RECEPTION_PAYMENT_NOT_VOIDABLE,
  RECEPTION_BUFFER_OVERRIDE_REQUIRED,
  MANAGEMENT_UNKNOWN_SETTING,
  MANAGEMENT_SETTING_TYPE_MISMATCH,
  MANAGEMENT_SUITE_PRIORITY_INVALID,
  MANAGEMENT_PERMISSION_ALREADY_HELD,
  MANAGEMENT_PERMISSION_NOT_HELD,
  MANAGEMENT_STAFF_INACTIVE,
  RECEPTION_DURATION_CONFLICT,
  RECEPTION_OVERRUN_RATE_INVALID,
  RECEPTION_OVERRUN_NO_GUESTS,
]);

export type BookingMutation<T> =
  | { outcome: "ok"; value: T }
  | { outcome: "no_suite" }
  | { outcome: "refused"; code: string; message: string }
  | { outcome: "failed"; message: string };

function bookingOutcome<T>(
  data: unknown,
  error: { code?: string; message: string } | null,
  parse: (rows: unknown[]) => T | null,
): BookingMutation<T> {
  if (error) {
    const code = error.code ?? "";
    if (code === RECEPTION_NO_SUITE) return { outcome: "no_suite" };
    if (REFUSAL_CODES.has(code)) {
      return { outcome: "refused", code, message: databaseErrorMessage(error) };
    }
    console.error("[database] action failed:", error);
    return { outcome: "failed", message: databaseErrorMessage(error) };
  }

  const rows = Array.isArray(data) ? data : data == null ? [] : [data];
  const value = parse(rows);
  if (value === null) {
    return { outcome: "failed", message: ACTION_UNCONFIRMED };
  }

  return { outcome: "ok", value };
}

const createdBookingSchema = z.object({
  booking_id: z.string(),
  reference: z.string(),
  suite_id: z.string(),
  suite_number: z.number().int(),
});

export interface CreatedBooking {
  bookingId: string;
  reference: string;
  suiteId: string;
  suiteNumber: number;
}

export interface PricedBreakdownInput {
  subtotalFils: number;
  discountFils: number;
  addonsFils: number;
  serviceFeeFils: number;
  taxFils: number;
  totalFils: number;
  voucherCode: string | null;
}

export interface ReceptionBookingRpcInput {
  customerId?: string | null;
  suiteId?: string | null;
  source: "walk_in" | "telephone" | "manual" | "complimentary";
  salutation: "mr" | "ms";
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  phoneE164: string;
  phoneCountry: string;
  startsAt: string;
  durationHours: number;
  bufferMinutes: number;
  adults: number;
  childAges: readonly number[];
  addons: readonly { addonId: string; quantity: number }[];
  personalRequest: string;
  internalNote: string;
  price: PricedBreakdownInput;
  isComplimentary: boolean;
  acceptance: readonly {
    documentSlug: string;
    documentVersion: string;
    checkboxText: string;
  }[];
  reason: string;
  paymentMethod: "cash" | "card_terminal";
}

export async function createReceptionBooking(
  client: WellPlaceClient,
  input: ReceptionBookingRpcInput,
): Promise<BookingMutation<CreatedBooking>> {
  const { data, error } = await client.rpc("create_reception_booking_paid", {
    p_payment_method: input.paymentMethod,
    p_customer_id: input.customerId ?? undefined,
    p_suite_id: input.suiteId ?? undefined,
    p_source: input.source,
    p_salutation: input.salutation,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
    p_date_of_birth: input.dateOfBirth,
    p_phone_e164: input.phoneE164,
    p_phone_country: input.phoneCountry,
    p_starts_at: input.startsAt,
    p_duration_hours: input.durationHours,
    p_buffer_minutes: input.bufferMinutes,
    p_adults: input.adults,
    p_child_ages: [...input.childAges],
    p_addons: input.addons.map((addon) => ({
      addon_id: addon.addonId,
      quantity: addon.quantity,
    })),
    p_personal_request: input.personalRequest,
    p_internal_note: input.internalNote,
    p_price: {
      subtotal_fils: input.price.subtotalFils,
      discount_fils: input.price.discountFils,
      addons_fils: input.price.addonsFils,
      service_fee_fils: input.price.serviceFeeFils,
      tax_fils: input.price.taxFils,
      total_fils: input.price.totalFils,
      voucher_code: input.price.voucherCode,
    },
    p_is_complimentary: input.isComplimentary,
    p_acceptance: input.acceptance.map((record) => ({
      document_slug: record.documentSlug,
      document_version: record.documentVersion,
      checkbox_text: record.checkboxText,
    })),
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = createdBookingSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      bookingId: parsed.data.booking_id,
      reference: parsed.data.reference,
      suiteId: parsed.data.suite_id,
      suiteNumber: parsed.data.suite_number,
    };
  });
}

export interface RescheduledBooking {
  bookingId: string;
  suiteId: string;
  suiteNumber: number;
  experienceFrom: string;
  experienceTo: string;
}

const rescheduledSchema = z.object({
  booking_id: z.string(),
  suite_id: z.string(),
  suite_number: z.number().int(),
  experience_from: z.string(),
  experience_to: z.string(),
});

export async function cancelBooking(
  client: WellPlaceClient,
  bookingId: string,
  reason: string,
): Promise<BookingMutation<{ bookingId: string }>> {
  const { data, error } = await client.rpc("cancel_booking", {
    p_booking_id: bookingId,
    p_reason: reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const row = rows[0] as { booking_id?: unknown } | undefined;
    return typeof row?.booking_id === "string" ? { bookingId: row.booking_id } : null;
  });
}

export async function rescheduleBooking(
  client: WellPlaceClient,
  input: {
    bookingId: string;
    startsAt: string;
    durationMinutes?: number;
    durationHours?: number;
    reason: string;
  },
): Promise<BookingMutation<RescheduledBooking>> {
  const { data, error } = await client.rpc("reschedule_booking", {
    p_booking_id: input.bookingId,
    p_starts_at: input.startsAt,
    p_reason: input.reason,
    ...(input.durationHours === undefined ? {} : { p_duration_hours: input.durationHours }),
    ...(input.durationMinutes === undefined ? {} : { p_duration_minutes: input.durationMinutes }),
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = rescheduledSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      bookingId: parsed.data.booking_id,
      suiteId: parsed.data.suite_id,
      suiteNumber: parsed.data.suite_number,
      experienceFrom: parsed.data.experience_from,
      experienceTo: parsed.data.experience_to,
    };
  });
}

export async function extendBooking(
  client: WellPlaceClient,
  input: { bookingId: string; extraMinutes: number; reason: string },
): Promise<BookingMutation<{ bookingId: string; experienceTo: string }>> {
  const { data, error } = await client.rpc("extend_booking", {
    p_booking_id: input.bookingId,
    p_extra_minutes: input.extraMinutes,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const row = rows[0] as
      | { booking_id?: unknown; experience_to?: unknown }
      | undefined;
    return typeof row?.booking_id === "string" && typeof row.experience_to === "string"
      ? { bookingId: row.booking_id, experienceTo: row.experience_to }
      : null;
  });
}

export async function moveBooking(
  client: WellPlaceClient,
  input: {
    bookingId: string;
    suiteId: string;
    startsAt: string;
    allowUnavailable: boolean;
    reason: string;
  },
): Promise<BookingMutation<RescheduledBooking>> {
  const { data, error } = await client.rpc("move_booking", {
    p_booking_id: input.bookingId,
    p_suite_id: input.suiteId,
    p_starts_at: input.startsAt,
    p_allow_unavailable: input.allowUnavailable,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = rescheduledSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      bookingId: parsed.data.booking_id,
      suiteId: parsed.data.suite_id,
      suiteNumber: parsed.data.suite_number,
      experienceFrom: parsed.data.experience_from,
      experienceTo: parsed.data.experience_to,
    };
  });
}

export async function updateBookingDetails(
  client: WellPlaceClient,
  input: {
    bookingId: string;
    personalRequest: string;
    internalNote: string;
    reason: string;
  },
): Promise<BookingMutation<{ bookingId: string }>> {
  const { data, error } = await client.rpc("update_booking_details", {
    p_booking_id: input.bookingId,
    p_personal_request: input.personalRequest,
    p_internal_note: input.internalNote,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const row = rows[0] as { booking_id?: unknown } | undefined;
    return typeof row?.booking_id === "string" ? { bookingId: row.booking_id } : null;
  });
}

export interface OverrunRateArgs {
  actualEnd: string;
  adultRateFils: number | null;
  childRateFils: number | null;
  rateSource: OverrunRateSource | null;
}

type StayAction =
  | { kind: "arrival"; at: string }
  | { kind: "check_in"; at: string }
  | { kind: "check_out"; at: string }
  | { kind: "no_show" }
  | ({ kind: "overrun" } & OverrunRateArgs);

export async function recordStay(
  client: WellPlaceClient,
  bookingId: string,
  action: StayAction,
  reason: string,
): Promise<BookingMutation<{ bookingId: string }>> {
  const call = async () => {
    switch (action.kind) {
      case "arrival":
        return client.rpc("record_arrival", {
          p_booking_id: bookingId,
          p_arrived_at: action.at,
          p_reason: reason,
        });
      case "check_in":
        return client.rpc("check_in_booking", {
          p_booking_id: bookingId,
          p_at: action.at,
          p_reason: reason,
        });
      case "check_out":
        return client.rpc("check_out_booking", {
          p_booking_id: bookingId,
          p_at: action.at,
          p_reason: reason,
        });
      case "no_show":
        return client.rpc("mark_no_show", {
          p_booking_id: bookingId,
          p_reason: reason,
        });
      case "overrun":
        return client.rpc("record_overrun", {
          p_booking_id: bookingId,
          p_actual_end: action.actualEnd,
          p_adult_rate_fils: action.adultRateFils as number,
          p_child_rate_fils: action.childRateFils as number,
          p_rate_source: action.rateSource as string,
          p_reason: reason,
        });
    }
  };

  const { data, error } = await call();

  return bookingOutcome(data, error, (rows) => {
    const row = rows[0] as { booking_id?: unknown } | undefined;
    return typeof row?.booking_id === "string" ? { bookingId: row.booking_id } : null;
  });
}

const recordedOverrunSchema = z.object({
  booking_id: z.string(),
  overrun_minutes: z.number().int(),
  increment_minutes: z.number().int().nullable(),
  chargeable_increments: z.number().int().nullable(),
  chargeable_minutes: z.number().int().nullable(),
  adults: z.number().int(),
  children: z.number().int(),
  rate_source: z.string().nullable(),
  overrun_fils: z.number().int().nullable(),
});

export interface RecordedOverrun {
  bookingId: string;
  overrunMinutes: number;
  incrementMinutes: number | null;
  chargeableIncrements: number | null;
  chargeableMinutes: number | null;
  adults: number;
  children: number;
  rateSource: string | null;
  overrunFils: number | null;
}

export async function recordOverrun(
  client: WellPlaceClient,
  bookingId: string,
  input: OverrunRateArgs,
  reason: string,
): Promise<BookingMutation<RecordedOverrun>> {
  const { data, error } = await client.rpc("record_overrun", {
    p_booking_id: bookingId,
    p_actual_end: input.actualEnd,
    p_adult_rate_fils: input.adultRateFils as number,
    p_child_rate_fils: input.childRateFils as number,
    p_rate_source: input.rateSource as string,
    p_reason: reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = recordedOverrunSchema.safeParse(rows[0]);
    if (!parsed.success) return null;

    return {
      bookingId: parsed.data.booking_id,
      overrunMinutes: parsed.data.overrun_minutes,
      incrementMinutes: parsed.data.increment_minutes,
      chargeableIncrements: parsed.data.chargeable_increments,
      chargeableMinutes: parsed.data.chargeable_minutes,
      adults: parsed.data.adults,
      children: parsed.data.children,
      rateSource: parsed.data.rate_source,
      overrunFils: parsed.data.overrun_fils,
    };
  });
}

export async function startCleaningTask(
  client: WellPlaceClient,
  taskId: string,
): Promise<BookingMutation<{ taskId: string }>> {
  const { data, error } = await client.rpc("start_cleaning_task", { p_task_id: taskId });
  return bookingOutcome(data, error, () => ({ taskId }));
}

export async function assignCleaningTask(
  client: WellPlaceClient,
  taskId: string,
  staffId: string | null,
): Promise<BookingMutation<{ taskId: string }>> {
  const { data, error } = await client.rpc("assign_cleaning_task", {
    p_task_id: taskId,
    p_staff_id: staffId as string,
  });
  return bookingOutcome(data, error, () => ({ taskId }));
}

export async function confirmCleaningTask(
  client: WellPlaceClient,
  taskId: string,
  note: string,
): Promise<BookingMutation<{ taskId: string }>> {
  const { data, error } = await client.rpc("confirm_cleaning_task", {
    p_task_id: taskId,
    p_note: note,
  });
  return bookingOutcome(data, error, () => ({ taskId }));
}

export async function resolveAlert(
  client: WellPlaceClient,
  alertId: string,
  note: string,
): Promise<BookingMutation<{ alertId: string }>> {
  const { data, error } = await client.rpc("resolve_alert", {
    p_alert_id: alertId,
    p_note: note,
  });
  return bookingOutcome(data, error, () => ({ alertId }));
}

export async function updateTaskStatus(
  client: WellPlaceClient,
  input: {
    taskId: string;
    status: Database["public"]["Enums"]["task_status"];
    note: string;
  },
): Promise<BookingMutation<{ taskId: string }>> {
  const { data, error } = await client.rpc("update_task_status", {
    p_task_id: input.taskId,
    p_status: input.status,
    p_note: input.note,
  });
  return bookingOutcome(data, error, () => ({ taskId: input.taskId }));
}

export async function addShiftNote(
  client: WellPlaceClient,
  shiftOn: string,
  body: string,
): Promise<BookingMutation<{ shiftOn: string }>> {
  const { data, error } = await client.rpc("add_shift_note", {
    p_shift_on: shiftOn,
    p_body: body,
  });
  return bookingOutcome(data, error, () => ({ shiftOn }));
}

export interface BlockImpactRow {
  suiteId: string;
  suiteNumber: number;
  occupancyId: string;
  occupancyKind: Database["public"]["Enums"]["occupancy_kind"];
  bookingId: string | null;
  bookingReference: string | null;
  bookingStatus: Database["public"]["Enums"]["booking_status"] | null;
  experienceFrom: string;
  experienceTo: string;
}

export async function previewBlockImpact(
  client: WellPlaceClient,
  input: { suiteIds: readonly string[]; from: string; to: string },
): Promise<BookingMutation<BlockImpactRow[]>> {
  const { data, error } = await client.rpc("preview_block_impact", {
    p_suite_ids: [...input.suiteIds],
    p_from: input.from,
    p_to: input.to,
  });

  return bookingOutcome(data, error, (rows) =>
    rows.map((row) => {
      const raw = row as {
        suite_id: string;
        suite_number: number;
        occupancy_id: string;
        occupancy_kind: Database["public"]["Enums"]["occupancy_kind"];
        booking_id: string | null;
        booking_reference: string | null;
        booking_status: Database["public"]["Enums"]["booking_status"] | null;
        experience_from: string;
        experience_to: string;
      };

      return {
        suiteId: raw.suite_id,
        suiteNumber: raw.suite_number,
        occupancyId: raw.occupancy_id,
        occupancyKind: raw.occupancy_kind,
        bookingId: raw.booking_id,
        bookingReference: raw.booking_reference,
        bookingStatus: raw.booking_status,
        experienceFrom: raw.experience_from,
        experienceTo: raw.experience_to,
      };
    }),
  );
}

export interface BlockedSuite {
  suiteId: string;
  suiteNumber: number;
  occupancyId: string | null;
  isBlocked: boolean;
}

export async function blockSuitePeriod(
  client: WellPlaceClient,
  input: {
    suiteIds: readonly string[];
    from: string;
    to: string;
    reason: string;
  },
): Promise<BookingMutation<BlockedSuite[]>> {
  const { data, error } = await client.rpc("block_suite_period", {
    p_suite_ids: [...input.suiteIds],
    p_from: input.from,
    p_to: input.to,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) =>
    rows.map((row) => {
      const raw = row as {
        suite_id: string;
        suite_number: number;
        occupancy_id: string | null;
        is_blocked: boolean;
      };
      return {
        suiteId: raw.suite_id,
        suiteNumber: raw.suite_number,
        occupancyId: raw.occupancy_id,
        isBlocked: raw.is_blocked,
      };
    }),
  );
}

export async function setSuiteStatus(
  client: WellPlaceClient,
  input: {
    suiteId: string;
    status: Database["public"]["Enums"]["suite_status"];
    reason: string;
  },
): Promise<BookingMutation<{ suiteId: string }>> {
  const { data, error } = await client.rpc("set_suite_status", {
    p_suite_id: input.suiteId,
    p_status: input.status,
    p_reason: input.reason,
  });
  return bookingOutcome(data, error, () => ({ suiteId: input.suiteId }));
}

export type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export interface RecordedPayment {
  paymentId: string;
  bookingId: string;
  amountFils: number;
  method: PaymentMethod;
  status: Database["public"]["Enums"]["payment_status"];
}

export async function recordBookingPayment(
  client: WellPlaceClient,
  input: {
    bookingId: string;
    method: PaymentMethod;
    amountFils: number;
    providerReference: string;
    note: string;
    reason: string;
  },
): Promise<BookingMutation<RecordedPayment>> {
  const { data, error } = await client.rpc("record_booking_payment", {
    p_booking_id: input.bookingId,
    p_method: input.method,
    p_amount_fils: input.amountFils,
    p_provider_reference: input.providerReference,
    p_note: input.note,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const raw = rows[0] as
      | {
          payment_id: string;
          booking_id: string;
          amount_fils: number;
          payment_method: PaymentMethod;
          payment_status: Database["public"]["Enums"]["payment_status"];
        }
      | undefined;

    if (!raw) return null;

    return {
      paymentId: raw.payment_id,
      bookingId: raw.booking_id,
      amountFils: raw.amount_fils,
      method: raw.payment_method,
      status: raw.payment_status,
    };
  });
}

export async function recordRefund(
  client: WellPlaceClient,
  input: { paymentId: string; amountFils: number; reason: string },
): Promise<BookingMutation<{ refundId: string; refundedTotalFils: number }>> {
  const { data, error } = await client.rpc("record_refund", {
    p_payment_id: input.paymentId,
    p_amount_fils: input.amountFils,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const raw = rows[0] as
      | { refund_id: string; refunded_total_fils: number }
      | undefined;
    return raw
      ? { refundId: raw.refund_id, refundedTotalFils: raw.refunded_total_fils }
      : null;
  });
}

export async function setManualBookingPrice(
  client: WellPlaceClient,
  input: { bookingId: string; totalFils: number; reason: string },
): Promise<BookingMutation<{ bookingId: string; totalFils: number }>> {
  const { data, error } = await client.rpc("set_manual_booking_price", {
    p_booking_id: input.bookingId,
    p_total_fils: input.totalFils,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const raw = rows[0] as
      | { booking_id: string; total_fils: number }
      | undefined;
    return raw ? { bookingId: raw.booking_id, totalFils: raw.total_fils } : null;
  });
}

export interface OpenedAlert {
  alertId: string;
  isNew: boolean;
}

export async function openAlert(
  client: WellPlaceClient,
  input: {
    kind: Database["public"]["Enums"]["alert_kind"];
    severity: Database["public"]["Enums"]["alert_severity"];
    entity: string;
    entityId: string;
    detail: Json;
  },
): Promise<BookingMutation<OpenedAlert>> {
  const { data, error } = await client.rpc("open_alert", {
    p_kind: input.kind,
    p_severity: input.severity,
    p_entity: input.entity,
    p_entity_id: input.entityId,
    p_detail: input.detail,
  });

  return bookingOutcome(data, error, (rows) => {
    const raw = rows[0] as { alert_id: string; is_new: boolean } | undefined;
    return raw ? { alertId: raw.alert_id, isNew: raw.is_new } : null;
  });
}

export async function createTask(
  client: WellPlaceClient,
  input: {
    title: string;
    note: string;
    assignedTo: string | null;
    dueOn: string | null;
    priority: Database["public"]["Enums"]["task_priority"];
  },
): Promise<BookingMutation<{ taskId: string }>> {
  const { data, error } = await client.rpc("create_task", {
    p_title: input.title,
    p_note: input.note,
    p_assigned_to: input.assignedTo as string,
    p_due_on: input.dueOn as string,
    p_priority: input.priority,
  });

  return bookingOutcome(data, error, (rows) => {
    const raw = rows[0] as { task_id?: unknown } | undefined;
    return typeof raw?.task_id === "string" ? { taskId: raw.task_id } : null;
  });
}

export type CmsMutationResult =
  | { outcome: "ok"; status: "draft" | "published"; updatedAt: string }
  | { outcome: "failed"; message: string };

const cmsRowSchema = z.object({
  status: z.enum(["draft", "published"]),
  updated_at: z.string(),
});

function cmsResult(data: unknown, error: { code?: string; message: string } | null): CmsMutationResult {
  if (error) return { outcome: "failed", message: databaseErrorMessage(error) };

  const parsed = cmsRowSchema.safeParse(Array.isArray(data) ? data[0] : data);
  if (!parsed.success) {
    return { outcome: "failed", message: ACTION_UNCONFIRMED };
  }

  return {
    outcome: "ok",
    status: parsed.data.status,
    updatedAt: parsed.data.updated_at,
  };
}

export async function saveCmsDraft(
  client: WellPlaceClient,
  slug: string,
  data: Json,
): Promise<CmsMutationResult> {
  const response = await client.rpc("save_cms_draft", { p_slug: slug, p_data: data });
  return cmsResult(response.data, response.error);
}

export async function publishCmsPage(
  client: WellPlaceClient,
  slug: string,
  label: string | null,
): Promise<CmsMutationResult> {
  const response = await client.rpc("publish_cms_page", {
    p_slug: slug,
    p_label: label ?? undefined,
  });
  return cmsResult(response.data, response.error);
}

export async function resetCmsPage(
  client: WellPlaceClient,
  slug: string,
  reason: string | null,
): Promise<CmsMutationResult> {
  const response = await client.rpc("reset_cms_page", {
    p_slug: slug,
    p_reason: reason ?? undefined,
  });
  return cmsResult(response.data, response.error);
}

export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type MessageChannel = Database["public"]["Enums"]["message_channel"];
export type MessageStatus = Database["public"]["Enums"]["message_status"];
export type NamedPermission = Database["public"]["Enums"]["named_permission"];
export type OccupancyStatus = Database["public"]["Enums"]["occupancy_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];

const lateArrivalSchema = z.object({
  booking_id: z.string(),
  status: z.string(),
  late_arrival_minutes: z.number().int(),
});

export interface LateArrival {
  bookingId: string;
  status: BookingStatus;
  lateArrivalMinutes: number;
}

export async function markLateArrival(
  client: WellPlaceClient,
  input: { bookingId: string; minutes: number; reason: string },
): Promise<BookingMutation<LateArrival>> {
  const { data, error } = await client.rpc("mark_late_arrival", {
    p_booking_id: input.bookingId,
    p_minutes: input.minutes,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = lateArrivalSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      bookingId: parsed.data.booking_id,
      status: parsed.data.status as BookingStatus,
      lateArrivalMinutes: parsed.data.late_arrival_minutes,
    };
  });
}

const releasedBlockSchema = z.object({
  occupancy_id: z.string(),
  suite_id: z.string(),
  suite_number: z.number().int(),
  status: z.string(),
});

export interface ReleasedBlock {
  occupancyId: string;
  suiteId: string;
  suiteNumber: number;
  status: OccupancyStatus;
}

export async function releaseSuiteBlock(
  client: WellPlaceClient,
  input: { occupancyId: string; reason: string },
): Promise<BookingMutation<ReleasedBlock>> {
  const { data, error } = await client.rpc("release_suite_block", {
    p_occupancy_id: input.occupancyId,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = releasedBlockSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      occupancyId: parsed.data.occupancy_id,
      suiteId: parsed.data.suite_id,
      suiteNumber: parsed.data.suite_number,
      status: parsed.data.status as OccupancyStatus,
    };
  });
}

const assignedTaskSchema = z.object({
  task_id: z.string(),
  status: z.string(),
  assigned_to: z.string().nullable(),
  assigned_by: z.string().nullable(),
});

export interface AssignedTask {
  taskId: string;
  status: TaskStatus;
  assignedTo: string | null;
  assignedBy: string | null;
}

export async function assignTask(
  client: WellPlaceClient,
  input: { taskId: string; staffId: string | null },
): Promise<BookingMutation<AssignedTask>> {
  const { data, error } = await client.rpc("assign_task", {
    p_task_id: input.taskId,
    p_staff_id: input.staffId as string,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = assignedTaskSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      taskId: parsed.data.task_id,
      status: parsed.data.status as TaskStatus,
      assignedTo: parsed.data.assigned_to,
      assignedBy: parsed.data.assigned_by,
    };
  });
}

const handedOverShiftSchema = z.object({
  shift_note_id: z.string(),
  shift_on: z.string(),
  handed_over_at: z.string(),
});

export interface HandedOverShift {
  shiftNoteId: string;
  shiftOn: string;
  handedOverAt: string;
}

export async function handOverShift(
  client: WellPlaceClient,
  noteId: string,
): Promise<BookingMutation<HandedOverShift>> {
  const { data, error } = await client.rpc("hand_over_shift", { p_note_id: noteId });

  return bookingOutcome(data, error, (rows) => {
    const parsed = handedOverShiftSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      shiftNoteId: parsed.data.shift_note_id,
      shiftOn: parsed.data.shift_on,
      handedOverAt: parsed.data.handed_over_at,
    };
  });
}

const customerWarningSchema = z.object({
  customer_id: z.string(),
  is_blocked: z.boolean(),
  warning_note: z.string().nullable(),
});

export interface CustomerWarning {
  customerId: string;
  isBlocked: boolean;
  warningNote: string | null;
}

export async function setCustomerWarning(
  client: WellPlaceClient,
  input: {
    customerId: string;
    warningNote: string | null;
    isBlocked: boolean;
    reason: string;
  },
): Promise<BookingMutation<CustomerWarning>> {
  const { data, error } = await client.rpc("set_customer_warning", {
    p_customer_id: input.customerId,
    p_warning_note: input.warningNote as string,
    p_is_blocked: input.isBlocked,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = customerWarningSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      customerId: parsed.data.customer_id,
      isBlocked: parsed.data.is_blocked,
      warningNote: parsed.data.warning_note,
    };
  });
}

const customerRecordSchema = z.object({
  customer_id: z.string(),
  reference: z.string(),
});

export interface CustomerRecordRef {
  customerId: string;
  reference: string;
}

export interface CustomerRecordInput {
  salutation: "mr" | "ms" | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phoneE164: string;
  phoneCountry: string;
  internalNote: string | null;
}

function customerRecordRef(rows: unknown[]): CustomerRecordRef | null {
  const parsed = customerRecordSchema.safeParse(rows[0]);
  return parsed.success ? { customerId: parsed.data.customer_id, reference: parsed.data.reference } : null;
}

export async function createCustomer(
  client: WellPlaceClient,
  input: CustomerRecordInput & { email: string; reason: string },
): Promise<BookingMutation<CustomerRecordRef>> {
  const { data, error } = await client.rpc("create_customer", {
    p_salutation: input.salutation as "mr" | "ms",
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
    p_date_of_birth: input.dateOfBirth as string,
    p_phone_e164: input.phoneE164,
    p_phone_country: input.phoneCountry,
    p_internal_note: input.internalNote as string,
    p_reason: input.reason,
  });
  return bookingOutcome(data, error, customerRecordRef);
}

export async function updateCustomer(
  client: WellPlaceClient,
  input: CustomerRecordInput & { customerId: string; reason: string },
): Promise<BookingMutation<CustomerRecordRef>> {
  const { data, error } = await client.rpc("update_customer", {
    p_customer_id: input.customerId,
    p_salutation: input.salutation as "mr" | "ms",
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_date_of_birth: input.dateOfBirth as string,
    p_phone_e164: input.phoneE164,
    p_phone_country: input.phoneCountry,
    p_internal_note: input.internalNote as string,
    p_reason: input.reason,
  });
  return bookingOutcome(data, error, customerRecordRef);
}

export async function deleteCustomer(
  client: WellPlaceClient,
  input: { customerId: string; reason: string },
): Promise<BookingMutation<CustomerRecordRef>> {
  const { data, error } = await client.rpc("delete_customer", {
    p_customer_id: input.customerId,
    p_reason: input.reason,
  });
  return bookingOutcome(data, error, customerRecordRef);
}

const overriddenBufferSchema = z.object({
  booking_id: z.string(),
  occupancy_id: z.string(),
  cleaning_buffer_minutes: z.number().int(),
  blocked_to: z.string(),
});

export interface OverriddenBuffer {
  bookingId: string;
  occupancyId: string;
  cleaningBufferMinutes: number;
  blockedTo: string;
}

export async function overrideBookingBuffer(
  client: WellPlaceClient,
  input: { bookingId: string; bufferMinutes: number; reason: string },
): Promise<BookingMutation<OverriddenBuffer>> {
  const { data, error } = await client.rpc("override_booking_buffer", {
    p_booking_id: input.bookingId,
    p_buffer_minutes: input.bufferMinutes,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = overriddenBufferSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      bookingId: parsed.data.booking_id,
      occupancyId: parsed.data.occupancy_id,
      cleaningBufferMinutes: parsed.data.cleaning_buffer_minutes,
      blockedTo: parsed.data.blocked_to,
    };
  });
}

const voidedPaymentSchema = z.object({
  payment_id: z.string(),
  booking_id: z.string(),
  payment_status: z.string(),
  previous_status: z.string(),
  amount_fils: z.number().int(),
});

export interface VoidedPayment {
  paymentId: string;
  bookingId: string;
  status: PaymentStatus;
  previousStatus: PaymentStatus;
  amountFils: number;
}

export async function voidBookingPayment(
  client: WellPlaceClient,
  input: { paymentId: string; reason: string },
): Promise<BookingMutation<VoidedPayment>> {
  const { data, error } = await client.rpc("void_booking_payment", {
    p_payment_id: input.paymentId,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = voidedPaymentSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      paymentId: parsed.data.payment_id,
      bookingId: parsed.data.booking_id,
      status: parsed.data.payment_status as PaymentStatus,
      previousStatus: parsed.data.previous_status as PaymentStatus,
      amountFils: parsed.data.amount_fils,
    };
  });
}

const queuedMessageSchema = z.object({
  message_id: z.string(),
  template_key: z.string(),
  channel: z.string(),
  status: z.string(),
  is_marketing: z.boolean(),
  to_address: z.string(),
});

export interface QueuedMessage {
  messageId: string;
  templateKey: string;
  channel: MessageChannel;
  status: MessageStatus;
  isMarketing: boolean;
  toAddress: string;
}

export async function queueMessage(
  client: WellPlaceClient,
  input: {
    templateKey: string;
    channel: MessageChannel;
    bookingId: string | null;
    customerId: string | null;
    toAddress: string;
    subject: string | null;
    body: string;
  },
): Promise<BookingMutation<QueuedMessage>> {
  const { data, error } = await client.rpc("queue_message", {
    p_template_key: input.templateKey,
    p_channel: input.channel,
    p_booking_id: input.bookingId as string,
    p_customer_id: input.customerId as string,
    p_to_address: input.toAddress,
    p_subject: input.subject as string,
    p_body: input.body,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = queuedMessageSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      messageId: parsed.data.message_id,
      templateKey: parsed.data.template_key,
      channel: parsed.data.channel as MessageChannel,
      status: parsed.data.status as MessageStatus,
      isMarketing: parsed.data.is_marketing,
      toAddress: parsed.data.to_address,
    };
  });
}

const messageAttemptSchema = z.object({
  message_id: z.string(),
  status: z.string(),
  attempt_count: z.number().int(),
  last_attempt_at: z.string().nullable(),
  sent_at: z.string().nullable(),
  failed_at: z.string().nullable(),
});

export interface MessageAttempt {
  messageId: string;
  status: MessageStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
}

export async function recordMessageAttempt(
  client: WellPlaceClient,
  input: {
    messageId: string;
    status: MessageStatus;
    providerMessageId: string | null;
    error: string | null;
  },
): Promise<BookingMutation<MessageAttempt>> {
  const { data, error } = await client.rpc("record_message_attempt", {
    p_message_id: input.messageId,
    p_status: input.status,
    p_provider_message_id: input.providerMessageId as string,
    p_error: input.error as string,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = messageAttemptSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      messageId: parsed.data.message_id,
      status: parsed.data.status as MessageStatus,
      attemptCount: parsed.data.attempt_count,
      lastAttemptAt: parsed.data.last_attempt_at,
      sentAt: parsed.data.sent_at,
      failedAt: parsed.data.failed_at,
    };
  });
}

const settingRowSchema = z.object({
  setting_key: z.string(),
  setting_value: z.unknown(),
  value_type: z.string(),
  source_tag: z.string(),
  updated_at: z.string(),
});

export async function setOverstayCharges(
  client: WellPlaceClient,
  input: { rateSource: OverrunRateSource; amountFils: number | null; reason: string },
): Promise<BookingMutation<{ rateSource: OverrunRateSource; amountFils: number | null }>> {
  const { data, error } = await client.rpc("set_overstay_charges", {
    p_value: { rateSource: input.rateSource, amountFils: input.amountFils },
    p_reason: input.reason,
  });
  return bookingOutcome(data, error, (rows) => {
    const parsed = z.object({ rate_source: z.enum(["regular_hourly", "offer_hourly", "fixed"]), amount_fils: z.number().int().nullable() }).safeParse(rows[0]);
    return parsed.success ? { rateSource: parsed.data.rate_source, amountFils: parsed.data.amount_fils } : null;
  });
}

export interface SavedSetting {
  key: string;
  value: Json;
  valueType: string;
  sourceTag: string;
  updatedAt: string;
}

export async function setSetting(
  client: WellPlaceClient,
  input: { key: string; value: Json; reason: string },
): Promise<BookingMutation<SavedSetting>> {
  const { data, error } = await client.rpc("set_setting", {
    p_key: input.key,
    p_value: input.value,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = settingRowSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      key: parsed.data.setting_key,
      value: (parsed.data.setting_value ?? null) as Json,
      valueType: parsed.data.value_type,
      sourceTag: parsed.data.source_tag,
      updatedAt: parsed.data.updated_at,
    };
  });
}

const suiteConfigurationResultSchema = z.object({
  suite_id: z.uuid(), suite_number: z.number().int(), display_name: z.string().nullable(), is_active: z.boolean(),
});

export async function saveSuiteConfiguration(
  client: WellPlaceClient,
  input: { suiteId: string; suiteNumber: number; displayName: string; create: boolean; reason: string; priority: number; internalNote: string },
): Promise<BookingMutation<{ suiteId: string }>> {
  const { data, error } = await client.rpc("save_suite_setup", {
    p_suite_id: input.suiteId, p_suite_number: input.suiteNumber, p_display_name: input.displayName,
    p_create: input.create, p_reason: input.reason,
    p_priority: input.priority, p_internal_note: input.internalNote,
  });
  return bookingOutcome(data, error, (rows) => {
    const parsed = suiteConfigurationResultSchema.safeParse(rows[0]);
    return parsed.success ? { suiteId: parsed.data.suite_id } : null;
  });
}

const suiteDetailsSchema = z.object({
  suite_id: z.string(),
  suite_number: z.number().int(),
  priority: z.number().int(),
  previous_priority: z.number().int(),
  internal_note: z.string().nullable(),
});

export interface SuiteDetails {
  suiteId: string;
  suiteNumber: number;
  priority: number;
  previousPriority: number;
  internalNote: string | null;
}

export async function setSuiteDetails(
  client: WellPlaceClient,
  input: {
    suiteId: string;
    priority: number | null;
    internalNote: string | null;
    reason: string;
  },
): Promise<BookingMutation<SuiteDetails>> {
  const { data, error } = await client.rpc("set_suite_details", {
    p_suite_id: input.suiteId,
    p_priority: input.priority as number,
    p_internal_note: input.internalNote as string,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = suiteDetailsSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      suiteId: parsed.data.suite_id,
      suiteNumber: parsed.data.suite_number,
      priority: parsed.data.priority,
      previousPriority: parsed.data.previous_priority,
      internalNote: parsed.data.internal_note,
    };
  });
}

const messageTemplateSchema = z.object({
  template_key: z.string(),
  channel: z.string(),
  is_active: z.boolean(),
  is_marketing: z.boolean(),
  subject: z.string().nullable(),
  body: z.string(),
  timing_minutes: z.number().int().nullable(),
  was_created: z.boolean(),
  updated_at: z.string(),
});

export interface SavedMessageTemplate {
  key: string;
  channel: MessageChannel;
  isActive: boolean;
  isMarketing: boolean;
  subject: string | null;
  body: string;
  timingMinutes: number | null;
  wasCreated: boolean;
  updatedAt: string;
}

export async function setMessageTemplate(
  client: WellPlaceClient,
  input: {
    key: string;
    channel: MessageChannel;
    isActive: boolean;
    subject: string | null;
    body: string | null;
    timingMinutes: number | null;
    reason: string;
  },
): Promise<BookingMutation<SavedMessageTemplate>> {
  const { data, error } = await client.rpc("set_message_template", {
    p_key: input.key,
    p_channel: input.channel,
    p_is_active: input.isActive,
    p_subject: input.subject as string,
    p_body: input.body as string,
    p_timing_minutes: input.timingMinutes as number,
    p_reason: input.reason,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = messageTemplateSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      key: parsed.data.template_key,
      channel: parsed.data.channel as MessageChannel,
      isActive: parsed.data.is_active,
      isMarketing: parsed.data.is_marketing,
      subject: parsed.data.subject,
      body: parsed.data.body,
      timingMinutes: parsed.data.timing_minutes,
      wasCreated: parsed.data.was_created,
      updatedAt: parsed.data.updated_at,
    };
  });
}

const messageDraftSchema = z.object({
  template_key: z.string(),
  has_draft: z.boolean(),
  has_document: z.boolean(),
  draft_blocks: z.number().int(),
  draft_saved_at: z.string(),
});

export interface SavedMessageDraft {
  key: string;
  hasDraft: boolean;
  hasDocument: boolean;
  draftBlocks: number;
  savedAt: string;
}

export async function saveMessageTemplateDraft(
  client: WellPlaceClient,
  input: {
    key: SystemMessageKey;
    document: Json;
    subject: string | null;
    preheader: string | null;
  },
): Promise<BookingMutation<SavedMessageDraft>> {
  const { data, error } = await client.rpc("save_message_template_draft", {
    p_key: input.key,
    p_document: input.document,
    p_subject: input.subject as string,
    p_preheader: input.preheader as string,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = messageDraftSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      key: parsed.data.template_key,
      hasDraft: parsed.data.has_draft,
      hasDocument: parsed.data.has_document,
      draftBlocks: parsed.data.draft_blocks,
      savedAt: parsed.data.draft_saved_at,
    };
  });
}

const publishedMessageSchema = z.object({
  template_key: z.string(),
  published_blocks: z.number().int(),
  published_at: z.string(),
  has_draft: z.boolean(),
});

export interface PublishedMessageTemplate {
  key: string;
  publishedBlocks: number;
  publishedAt: string;
  hasDraft: boolean;
}

export async function publishMessageTemplate(
  client: WellPlaceClient,
  input: { key: SystemMessageKey },
): Promise<BookingMutation<PublishedMessageTemplate>> {
  const { data, error } = await client.rpc("publish_message_template", {
    p_key: input.key,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = publishedMessageSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      key: parsed.data.template_key,
      publishedBlocks: parsed.data.published_blocks,
      publishedAt: parsed.data.published_at,
      hasDraft: parsed.data.has_draft,
    };
  });
}

const resetMessageSchema = z.object({
  template_key: z.string(),
  cleared_document: z.boolean(),
  cleared_draft: z.boolean(),
  reset_at: z.string(),
});

export interface ResetMessageTemplate {
  key: string;
  clearedDocument: boolean;
  clearedDraft: boolean;
  resetAt: string;
}

export async function resetMessageTemplate(
  client: WellPlaceClient,
  input: { key: SystemMessageKey },
): Promise<BookingMutation<ResetMessageTemplate>> {
  const { data, error } = await client.rpc("reset_message_template", {
    p_key: input.key,
  });

  return bookingOutcome(data, error, (rows) => {
    const parsed = resetMessageSchema.safeParse(rows[0]);
    if (!parsed.success) return null;
    return {
      key: parsed.data.template_key,
      clearedDocument: parsed.data.cleared_document,
      clearedDraft: parsed.data.cleared_draft,
      resetAt: parsed.data.reset_at,
    };
  });
}

export async function setSettingsGroup(
  client: WellPlaceClient,
  input: { changes: Json; reason: string },
): Promise<BookingMutation<{ savedCount: number }>> {
  const { data, error } = await client.rpc("set_settings_group", {
    p_changes: input.changes, p_reason: input.reason,
  });
  return bookingOutcome(data, error, (rows) => {
    const parsed = z.object({ saved_count: z.number().int() }).safeParse(rows[0]);
    return parsed.success ? { savedCount: parsed.data.saved_count } : null;
  });
}

export async function saveCatalogueItem(client: WellPlaceClient, kind: "price" | "addon", values: Json, expected: Json) {
  const { data, error } = await client.rpc("save_catalogue_item", { p_kind: kind, p_values: values, p_expected: expected });
  if (error) {
    console.error("[catalogue] save failed", error.code);
    return { ok: false as const, message: error.code === "WP060" ? databaseErrorMessage(error) : "This item could not be saved. Check its values and try again." };
  }
  const id = z.uuid().safeParse(data);
  return id.success ? { ok: true as const, id: id.data } : { ok: false as const, message: "The save could not be confirmed. Reload the catalogue." };
}

export type SuiteStatus = Database["public"]["Enums"]["suite_status"];

const suiteStatusSchema = z.enum(SUITE_STATUSES);

export interface RetiredSuite {
  suiteId: string;
  suiteNumber: number;
  status: SuiteStatus;
  retiredAt: string;
}

export async function retireSuite(
  client: WellPlaceClient,
  input: { suiteId: string; reason: string },
): Promise<BookingMutation<RetiredSuite>> {
  const { data, error } = await client.rpc("retire_suite", { p_suite_id: input.suiteId, p_reason: input.reason });
  return bookingOutcome(data, error, (rows) => {
    const parsed = z.object({ suite_id: z.uuid(), suite_number: z.number().int(), status: suiteStatusSchema, retired_at: z.string() }).safeParse(rows[0]);
    if (!parsed.success) {
      console.error("[db] retire_suite returned an unexpected row:", parsed.error.issues[0]?.message);
      return null;
    }
    return { suiteId: parsed.data.suite_id, suiteNumber: parsed.data.suite_number, status: parsed.data.status, retiredAt: parsed.data.retired_at };
  });
}

export interface ReturnedSuite {
  suiteId: string;
  suiteNumber: number;
  status: SuiteStatus;
  isActive: boolean;
}

export async function returnSuiteToService(
  client: WellPlaceClient,
  input: { suiteId: string; reason: string },
): Promise<BookingMutation<ReturnedSuite>> {
  const { data, error } = await client.rpc("return_suite_to_service", { p_suite_id: input.suiteId, p_reason: input.reason });
  return bookingOutcome(data, error, (rows) => {
    const parsed = z.object({ suite_id: z.uuid(), suite_number: z.number().int(), status: suiteStatusSchema, is_active: z.boolean() }).safeParse(rows[0]);
    if (!parsed.success) {
      console.error("[db] return_suite_to_service returned an unexpected row:", parsed.error.issues[0]?.message);
      return null;
    }
    return { suiteId: parsed.data.suite_id, suiteNumber: parsed.data.suite_number, status: parsed.data.status, isActive: parsed.data.is_active };
  });
}

export interface DeletedSuite {
  suiteId: string;
  suiteNumber: number;
  deletedAt: string;
}

export async function deleteSuite(
  client: WellPlaceClient,
  input: { suiteId: string; reason: string },
): Promise<BookingMutation<DeletedSuite>> {
  const { data, error } = await client.rpc("delete_suite", { p_suite_id: input.suiteId, p_reason: input.reason });
  return bookingOutcome(data, error, (rows) => {
    const parsed = z.object({ suite_id: z.uuid(), suite_number: z.number().int(), deleted_at: z.string() }).safeParse(rows[0]);
    if (!parsed.success) {
      console.error("[db] delete_suite returned an unexpected row:", parsed.error.issues[0]?.message);
      return null;
    }
    return { suiteId: parsed.data.suite_id, suiteNumber: parsed.data.suite_number, deletedAt: parsed.data.deleted_at };
  });
}

function parseInvoiceRow(rows: unknown[]): Invoice | null {
  const parsed = invoiceRowSchema.safeParse(rows[0]);
  if (!parsed.success) {
    console.error("[invoices] unexpected invoice row:", parsed.error.issues[0]?.message);
    return null;
  }
  return toInvoice(parsed.data);
}

export interface InvoiceBillToCorrection {
  name?: string;
  company?: string | null;
  trn?: string | null;
  address?: string | null;
}

function billToArgument(billTo: InvoiceBillToCorrection | undefined): { p_bill_to: Json } | Record<string, never> {
  if (billTo === undefined) return {};
  const present = Object.fromEntries(Object.entries(billTo).filter(([, value]) => value !== undefined));
  return { p_bill_to: z.json().parse(present) };
}

export async function issueInvoice(
  client: WellPlaceClient,
  bookingId: string,
  billTo?: InvoiceBillToCorrection,
): Promise<BookingMutation<Invoice>> {
  const { data, error } = await client.rpc("issue_invoice", { p_booking_id: bookingId, ...billToArgument(billTo) });
  return bookingOutcome(data, error, parseInvoiceRow);
}

export async function regenerateInvoice(
  client: WellPlaceClient,
  input: { invoiceId: string; reason: string; billTo?: InvoiceBillToCorrection },
): Promise<BookingMutation<Invoice>> {
  const { data, error } = await client.rpc("regenerate_invoice", {
    p_invoice_id: input.invoiceId,
    p_reason: input.reason,
    ...billToArgument(input.billTo),
  });
  return bookingOutcome(data, error, parseInvoiceRow);
}

export async function voidInvoice(
  client: WellPlaceClient,
  input: { invoiceId: string; reason: string },
): Promise<BookingMutation<Invoice>> {
  const { data, error } = await client.rpc("void_invoice", { p_invoice_id: input.invoiceId, p_reason: input.reason });
  return bookingOutcome(data, error, parseInvoiceRow);
}

export async function confirmRefundReturn(client: WellPlaceClient, input: { refundId: string; reference: string; reason: string }): Promise<BookingMutation<{ bookingId: string }>> {
  const { data, error } = await client.rpc("confirm_refund_return", { p_refund_id: input.refundId, p_reference: input.reference, p_reason: input.reason });
  return bookingOutcome(data, error, (rows) => {
    const parsed = z.array(z.object({ refund_id: z.uuid(), booking_id: z.uuid() })).safeParse(rows);
    return parsed.success && parsed.data[0] ? { bookingId: parsed.data[0].booking_id } : null;
  });
}

export async function applyEmailFooterToAll(
  client: WellPlaceClient,
  input: { footer: string; footerDesign?: EmailFooterDesign; keys: readonly SystemMessageKey[] },
): Promise<BookingMutation<{ updatedCount: number }>> {
  const { data, error } = await client.rpc("apply_email_footer_to_all", {
    p_footer: input.footer,
    ...(input.footerDesign ? { p_design: z.json().parse(input.footerDesign) } : {}),
    p_keys: [...input.keys],
  });
  return bookingOutcome(data, error, (rows) => {
    const parsed = z.object({ updated_count: z.number().int().nonnegative() }).safeParse(rows[0]);
    return parsed.success ? { updatedCount: parsed.data.updated_count } : null;
  });
}

export async function applyEmailHeaderToAll(
  client: WellPlaceClient,
  input: { headerDesign: EmailHeaderDesign; keys: readonly SystemMessageKey[] },
): Promise<BookingMutation<{ updatedCount: number }>> {
  const { data, error } = await client.rpc("apply_email_header_to_all", {
    p_design: z.json().parse(input.headerDesign),
    p_keys: [...input.keys],
  });
  return bookingOutcome(data, error, (rows) => {
    const parsed = z.object({ updated_count: z.number().int().nonnegative() }).safeParse(rows[0]);
    return parsed.success ? { updatedCount: parsed.data.updated_count } : null;
  });
}
