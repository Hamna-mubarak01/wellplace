"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createCustomerSchema,
  deleteCustomerSchema,
  updateCustomerSchema,
} from "@/app/(console)/manage/customers/customer-inputs";
import { hasPermission, requireManagement } from "@/lib/auth/session";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import { listManagementCustomers } from "@/lib/db/queries/management-customers";
import {
  createCustomer,
  deleteCustomer,
  setCustomerWarning,
  updateCustomer,
  type BookingMutation,
  type CustomerRecordRef,
} from "@/lib/db/rpc";
import { createClient } from "@/lib/db/server";
import { ACTION_UNCONFIRMED } from "@/lib/domain/action-errors";
import { consoleCreate, consoleDelete, consoleEdit, reasonSchema } from "@/lib/validation/audit-reason";
import { idSchema } from "@/lib/validation/console-inputs";

const blockInput = z.object({
  customerId: idSchema,
  blocked: z.boolean({ error: "Choose whether to block or unblock this customer." }),
  reason: reasonSchema,
});

const searchInput = z.object({
  search: z.string().trim().max(CONSOLE_LIST.searchMaxLength, "Search with fewer characters."),
});

export type CustomerBlockResult = { ok: true; isBlocked: boolean } | { ok: false; message: string };

export type CustomerRecordResult =
  | { ok: true; customerId: string; reference: string }
  | { ok: false; message: string };

export interface BlockableCustomer {
  readonly id: string;
  readonly name: string;
  readonly reference: string;
  readonly email: string;
}

export type CustomerSearchResult =
  | { ok: true; customers: readonly BlockableCustomer[] }
  | { ok: false; message: string };

const NOT_PERMITTED =
  "Your account cannot add, edit, delete or block customers. Ask a colleague with customer correction permission to help.";

function refreshCustomers(): void {
  revalidatePath("/manage/customers", "layout");
  revalidatePath("/reception", "layout");
}

function recordOutcome(result: BookingMutation<CustomerRecordRef>): CustomerRecordResult {
  switch (result.outcome) {
    case "ok":
      refreshCustomers();
      return { ok: true, customerId: result.value.customerId, reference: result.value.reference };
    case "refused":
    case "failed":
      return { ok: false, message: result.message };
    case "no_suite":
      return { ok: false, message: ACTION_UNCONFIRMED };
  }
}

async function permitted(): Promise<boolean> {
  const session = await requireManagement();
  return hasPermission(session, "correct_customer_record");
}

export async function createCustomerRecord(input: unknown): Promise<CustomerRecordResult> {
  if (!(await permitted())) return { ok: false, message: NOT_PERMITTED };
  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details and try again." };

  try {
    return recordOutcome(
      await createCustomer(await createClient(), { ...parsed.data, reason: consoleCreate("Customer") }),
    );
  } catch (cause) {
    console.error("[manage] createCustomerRecord fault:", cause);
    return { ok: false, message: ACTION_UNCONFIRMED };
  }
}

export async function updateCustomerRecord(input: unknown): Promise<CustomerRecordResult> {
  if (!(await permitted())) return { ok: false, message: NOT_PERMITTED };
  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details and try again." };

  try {
    return recordOutcome(
      await updateCustomer(await createClient(), { ...parsed.data, reason: consoleEdit("Customer") }),
    );
  } catch (cause) {
    console.error("[manage] updateCustomerRecord fault:", cause);
    return { ok: false, message: ACTION_UNCONFIRMED };
  }
}

export async function deleteCustomerRecord(input: unknown): Promise<CustomerRecordResult> {
  if (!(await permitted())) return { ok: false, message: NOT_PERMITTED };
  const parsed = deleteCustomerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details and try again." };

  try {
    return recordOutcome(
      await deleteCustomer(await createClient(), { customerId: parsed.data.customerId, reason: consoleDelete("Customer") }),
    );
  } catch (cause) {
    console.error("[manage] deleteCustomerRecord fault:", cause);
    return { ok: false, message: ACTION_UNCONFIRMED };
  }
}

export async function setCustomerBlocked(input: unknown): Promise<CustomerBlockResult> {
  if (!(await permitted())) return { ok: false, message: NOT_PERMITTED };

  const parsed = blockInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  }

  try {
    const client = await createClient();
    const result = await setCustomerWarning(client, {
      customerId: parsed.data.customerId,
      warningNote: null,
      isBlocked: parsed.data.blocked,
      reason: parsed.data.reason,
    });

    switch (result.outcome) {
      case "ok":
        refreshCustomers();
        return { ok: true, isBlocked: result.value.isBlocked };
      case "refused":
      case "failed":
        return { ok: false, message: result.message };
      case "no_suite":
        return { ok: false, message: ACTION_UNCONFIRMED };
    }
  } catch (cause) {
    console.error("[manage] setCustomerBlocked fault:", cause);
    return { ok: false, message: ACTION_UNCONFIRMED };
  }
}

export async function searchCustomersToBlock(input: unknown): Promise<CustomerSearchResult> {
  await requireManagement();
  const parsed = searchInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Search with fewer characters." };
  }

  const list = await listManagementCustomers(await createClient(), {
    page: 1,
    pageSize: CONSOLE_LIST.customerPickerLimit,
    search: parsed.data.search,
    filter: "unblocked",
    sort: "recent",
  });
  if (!list.ok) return { ok: false, message: list.message };

  return {
    ok: true,
    customers: list.rows.map((row) => ({
      id: row.id,
      name: row.fullName.trim() === "" ? "Name not given" : row.fullName.trim(),
      reference: row.reference,
      email: row.email,
    })),
  };
}
