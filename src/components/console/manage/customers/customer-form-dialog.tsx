"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, UserRoundPlusIcon } from "lucide-react";
import { parsePhoneNumberFromString } from "libphonenumber-js";

import {
  createCustomerRecord,
  updateCustomerRecord,
  type CustomerRecordResult,
} from "@/app/(console)/manage/customers/actions";
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CustomerFormField,
} from "@/app/(console)/manage/customers/customer-inputs";
import { customerHref } from "@/app/(console)/manage/customers/customers-query";
import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";
import { DobSelect, EMPTY_DOB, type DateOfBirthValue } from "@/components/shared/dob-select";
import { PhoneInput, emptyPhoneValue, toE164, type PhoneValue } from "@/components/shared/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import { SETTINGS } from "@/lib/config/registry";
import type { ManagementCustomer } from "@/lib/db/queries/management-customers";

const NO_SALUTATION = "none";

type EditableCustomer = Pick<
  ManagementCustomer,
  "id" | "reference" | "salutation" | "firstName" | "lastName" | "email" | "dateOfBirth" | "phoneE164" | "phoneCountry" | "internalNote"
>;

export interface CustomerFormDialogProps {
  readonly customer?: EditableCustomer;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

interface Draft {
  salutation: "mr" | "ms" | null;
  firstName: string;
  lastName: string;
  email: string;
  dob: DateOfBirthValue;
  phone: PhoneValue;
  internalNote: string;
}

function dobFromIso(iso: string | null): DateOfBirthValue {
  if (iso === null) return EMPTY_DOB;
  const [year, month, day] = iso.split("-").map(Number);
  return { day: day ?? null, month: month ?? null, year: year ?? null };
}

function dobToIso(value: DateOfBirthValue): string | null {
  if (value.day === null || value.month === null || value.year === null) return null;
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function phoneFromCustomer(e164: string, country: string): PhoneValue {
  const parsed = parsePhoneNumberFromString(e164);
  const base = emptyPhoneValue(parsed?.country ?? country);
  const national = parsed?.nationalNumber ?? e164.replace(base.dialCode, "").replace(/\D/g, "");
  return { ...base, nationalNumber: String(national) };
}

function draftFor(customer: EditableCustomer | undefined): Draft {
  if (!customer) {
    return { salutation: null, firstName: "", lastName: "", email: "", dob: EMPTY_DOB, phone: emptyPhoneValue(), internalNote: "" };
  }
  return {
    salutation: customer.salutation,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    dob: dobFromIso(customer.dateOfBirth),
    phone: phoneFromCustomer(customer.phoneE164, customer.phoneCountry),
    internalNote: customer.internalNote ?? "",
  };
}

export function CustomerFormDialog({ customer, open: controlledOpen, onOpenChange }: CustomerFormDialogProps) {
  const router = useRouter();
  const idPrefix = useId();
  const [pending, start] = useTransition();
  const [ownOpen, setOwnOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFor(customer));
  const [errors, setErrors] = useState<Partial<Record<CustomerFormField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const editing = customer !== undefined;
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : ownOpen;
  const formId = `${idPrefix}-form`;
  const id = (field: string) => `${idPrefix}-${field}`;

  function changeOpen(next: boolean) {
    if (pending) return;
    if (next) {
      setDraft(draftFor(customer));
      setErrors({});
      setFailure(null);
    }
    if (!controlled) setOwnOpen(next);
    onOpenChange?.(next);
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    const partialDob = [draft.dob.day, draft.dob.month, draft.dob.year].some((part) => part !== null) && dobToIso(draft.dob) === null;
    const fields = {
      salutation: draft.salutation,
      firstName: draft.firstName,
      lastName: draft.lastName,
      dateOfBirth: dobToIso(draft.dob),
      phoneE164: toE164(draft.phone),
      phoneCountry: draft.phone.countryIso2.toUpperCase(),
      internalNote: draft.internalNote,
    };
    const parsed = customer
      ? updateCustomerSchema.safeParse({ ...fields, customerId: customer.id })
      : createCustomerSchema.safeParse({ ...fields, email: draft.email });

    const nextErrors: Partial<Record<CustomerFormField, string>> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as CustomerFormField;
        nextErrors[field] ??= issue.message;
      }
    }
    if (partialDob) nextErrors.dateOfBirth = "Choose the day, month and year, or leave all three empty.";
    setErrors(nextErrors);
    if (!parsed.success || partialDob) return;
    setFailure(null);

    start(async () => {
      let result: CustomerRecordResult;
      try {
        result = customer ? await updateCustomerRecord(parsed.data) : await createCustomerRecord(parsed.data);
      } catch (cause) {
        console.error("[manage] customer record could not be confirmed:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      if (!controlled) setOwnOpen(false);
      onOpenChange?.(false);
      if (customer) {
        toast.success("Customer details saved");
        router.refresh();
      } else {
        toast.success(`Customer ${result.reference} added`);
        router.push(customerHref(result.customerId));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          {editing ? (
            <Button type="button" variant="outline">
              <PencilIcon aria-hidden="true" className="size-4" />
              Edit
            </Button>
          ) : (
            <Button type="button">
              <UserRoundPlusIcon aria-hidden="true" className="size-4" />
              Add customer
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent
        aria-busy={pending || undefined}
        showCloseButton={!pending}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        className="flex max-h-dialog-max-h min-w-0 flex-col gap-4 overflow-hidden sm:max-w-3xl"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{customer ? `Edit ${customer.firstName} ${customer.lastName}` : "Add customer"}</DialogTitle>
          <DialogDescription>
            {customer
              ? `${customer.reference} · Update any detail except the email address.`
              : "A new customer appears under Leads until their first confirmed booking."}
          </DialogDescription>
        </DialogHeader>

        <form id={formId} onSubmit={submit} noValidate className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1">
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={id("salutation")} className="text-console-body">
                Title
              </FieldLabel>
              <Select
                value={draft.salutation ?? NO_SALUTATION}
                onValueChange={(value) => update("salutation", value === NO_SALUTATION ? null : (value as "mr" | "ms"))}
                disabled={pending}
              >
                <SelectTrigger id={id("salutation")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SALUTATION} className="min-h-tap">
                    Not given
                  </SelectItem>
                  <SelectItem value="mr" className="min-h-tap">
                    Mr.
                  </SelectItem>
                  <SelectItem value="ms" className="min-h-tap">
                    Ms.
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field data-invalid={Boolean(errors.email) || undefined}>
              <FieldLabel htmlFor={id("email")} className="text-console-body">
                Email
              </FieldLabel>
              <Input
                id={id("email")}
                type="email"
                value={draft.email}
                onChange={(event) => update("email", event.target.value)}
                disabled={pending || editing}
                aria-invalid={Boolean(errors.email) || undefined}
                autoComplete="off"
              />
              {editing ? (
                <FieldDescription className="text-micro text-text-muted">
                  The email links this customer&apos;s bookings and invoices, so it cannot be changed.
                </FieldDescription>
              ) : (
                errors.email && <p className="text-micro text-danger-ink">{errors.email}</p>
              )}
            </Field>

            <Field data-invalid={Boolean(errors.firstName) || undefined}>
              <FieldLabel htmlFor={id("first-name")} className="text-console-body">
                First name
              </FieldLabel>
              <Input
                id={id("first-name")}
                value={draft.firstName}
                maxLength={CONSOLE_LIST.customerNameMax}
                onChange={(event) => update("firstName", event.target.value)}
                disabled={pending}
                aria-invalid={Boolean(errors.firstName) || undefined}
              />
              {errors.firstName && <p className="text-micro text-danger-ink">{errors.firstName}</p>}
            </Field>

            <Field data-invalid={Boolean(errors.lastName) || undefined}>
              <FieldLabel htmlFor={id("last-name")} className="text-console-body">
                Last name
              </FieldLabel>
              <Input
                id={id("last-name")}
                value={draft.lastName}
                maxLength={CONSOLE_LIST.customerNameMax}
                onChange={(event) => update("lastName", event.target.value)}
                disabled={pending}
                aria-invalid={Boolean(errors.lastName) || undefined}
              />
              {errors.lastName && <p className="text-micro text-danger-ink">{errors.lastName}</p>}
            </Field>

            <PhoneInput
              id={id("phone")}
              label="Mobile"
              value={draft.phone}
              onChange={(value) => update("phone", value)}
              error={errors.phoneE164 ?? errors.phoneCountry}
              disabled={pending}
            />

            <DobSelect
              id={id("dob")}
              label="Date of birth"
              minAge={SETTINGS["booking.booker_min_age"].defaultValue}
              maxAge={null}
              value={draft.dob}
              onChange={(value) => update("dob", value)}
              error={errors.dateOfBirth}
              disabled={pending}
            />

            <Field className="md:col-span-2" data-invalid={Boolean(errors.internalNote) || undefined}>
              <FieldLabel htmlFor={id("note")} className="text-console-body">
                Internal note
              </FieldLabel>
              <Textarea
                id={id("note")}
                value={draft.internalNote}
                rows={3}
                maxLength={CONSOLE_LIST.customerNoteMax}
                onChange={(event) => update("internalNote", event.target.value)}
                disabled={pending}
                className="text-console-body"
              />
              <FieldDescription className="text-micro text-text-muted">Only staff see this note.</FieldDescription>
              {errors.internalNote && <p className="text-micro text-danger-ink">{errors.internalNote}</p>}
            </Field>
          </div>

          {failure !== null && (
            <div className="mt-4">
              <ActionError title="Nothing was saved" message={failure} />
            </div>
          )}
        </form>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="ghost" hoverEffect="sweep" onClick={() => changeOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? "Saving…" : customer ? "Save changes" : "Add customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
