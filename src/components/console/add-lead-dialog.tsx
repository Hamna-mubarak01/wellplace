"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { InfoIcon, LoaderCircleIcon, TriangleAlertIcon, UserPlusIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";
import { z } from "zod";

import { addLeadManually } from "@/app/(console)/manage/waitlist/actions";
import {
  dateOfBirthSchema,
  phoneSchema,
  salutationSchema,
} from "@/lib/validation/waitlist";
import {
  DobSelect,
  EMPTY_DOB,
  calculateAge,
  type DateOfBirthValue,
} from "@/components/shared/dob-select";
import {
  PhoneInput,
  emptyPhoneValue,
  toE164,
  type PhoneValue,
} from "@/components/shared/phone-input";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const ACTION_LABEL = "Add to waitlist";

const NAME_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 254;

const CONTROL_CLASS =
  "h-tap w-full rounded-(--radius-card) bg-surface-raised px-3 text-console-body";
const LABEL_CLASS = "text-field-label font-medium text-text-secondary";
const ERROR_CLASS = "text-micro font-medium";

const SALUTATIONS = [
  { value: "mr", label: "Mr." },
  { value: "ms", label: "Ms." },
] as const;

type Salutation = z.infer<typeof salutationSchema>;

const manualLeadSchema = z.object({
  salutation: salutationSchema,
  firstName: z.string().trim().min(1, "Enter their first name."),
  lastName: z.string().trim().min(1, "Enter their last name."),
  email: z.email("Enter an email address that will reach them."),
  dateOfBirth: dateOfBirthSchema,
  phone: phoneSchema,
});

type ManualLead = z.infer<typeof manualLeadSchema>;

type AddLeadOutcome = Awaited<ReturnType<typeof addLeadManually>>;

type Notice =
  | { kind: "duplicate"; email: string }
  | { kind: "error" };

const ID = "add-lead";

const FOCUS_TARGETS: Record<string, string> = {
  firstName: `${ID}-first-name`,
  lastName: `${ID}-last-name`,
  email: `${ID}-email`,
  dateOfBirth: `${ID}-dob-day`,
  phone: `${ID}-phone`,
  "phone.e164": `${ID}-phone`,
};

function focusField(key: string) {
  const id = FOCUS_TARGETS[key];
  if (!id) return;
  document.getElementById(id)?.focus();
}

export interface AddLeadDialogProps {
  minAge: number;
}

export function AddLeadDialog({ minAge }: AddLeadDialogProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [open, setOpen] = useState(false);
  const [salutation, setSalutation] = useState<Salutation>("mr");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState<DateOfBirthValue>(EMPTY_DOB);
  const [phone, setPhone] = useState<PhoneValue>(() => emptyPhoneValue());

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  function reset() {
    setSalutation("mr");
    setFirstName("");
    setLastName("");
    setEmail("");
    setDob(EMPTY_DOB);
    setPhone(emptyPhoneValue());
    setFieldErrors({});
    setNotice(null);
  }

  function firstError(...keys: string[]): string | undefined {
    for (const key of keys) {
      const message = fieldErrors[key];
      if (message) return message;
    }
    return undefined;
  }

  function clearError(...keys: string[]) {
    setFieldErrors((current) => {
      if (!keys.some((key) => key in current)) return current;
      const remaining = { ...current };
      for (const key of keys) delete remaining[key];
      return remaining;
    });
  }

  function reportErrors(errors: Record<string, string>) {
    setFieldErrors(errors);
    const first = Object.keys(errors)[0];
    if (first) focusField(first);
    toast.error("Check the customer details", { description: [...new Set(Object.values(errors))].join("\n\n") });
  }

  function validate():
    | { ok: true; data: ManualLead }
    | { ok: false; errors: Record<string, string> } {
    const parsed = manualLeadSchema.safeParse({
      salutation,
      firstName,
      lastName,
      email: email.trim(),
      dateOfBirth: {
        day: dob.day ?? undefined,
        month: dob.month ?? undefined,
        year: dob.year ?? undefined,
      },
      phone: { e164: toE164(phone), countryIso2: phone.countryIso2 },
    });

    const errors: Record<string, string> = {};

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        errors[key] ??= issue.message;
      }
      if (dob.day === null || dob.month === null || dob.year === null) {
        for (const key of Object.keys(errors)) {
          if (key.startsWith("dateOfBirth")) delete errors[key];
        }
        errors.dateOfBirth = "Choose their date of birth.";
      }
    }

    if (!errors.dateOfBirth) {
      const age = calculateAge(dob);
      if (age !== null && age < minAge) {
        errors.dateOfBirth = `They must be at least ${minAge} to join the waitlist.`;
      }
    }

    if (Object.keys(errors).length > 0) return { ok: false, errors };

    if (!parsed.success) return { ok: false, errors: { form: "Check the form." } };

    return { ok: true, data: parsed.data };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setNotice(null);

    const checked = validate();
    if (!checked.ok) {
      reportErrors(checked.errors);
      return;
    }

    setFieldErrors({});
    const entry = checked.data;

    start(async () => {
      let outcome: AddLeadOutcome;
      try {
        outcome = await addLeadManually(entry);
      } catch (cause) {
        console.error("[console] add lead threw:", cause);
        setNotice({ kind: "error" });
        noticeRef.current?.focus();
        return;
      }

      switch (outcome.status) {
        case "added":
          setOpen(false);
          reset();
          router.refresh();
          toast.success("Added to the waitlist", {
            description: `${entry.firstName} ${entry.lastName} will hear from WellPlace when booking opens.`,
          });
          return;

        case "duplicate":
          setNotice({ kind: "duplicate", email: entry.email });
          focusField("email");
          return;

        case "invalid":
          reportErrors(outcome.fieldErrors);
          return;

        default:
          setNotice({ kind: "error" });
          noticeRef.current?.focus();
      }
    });
  }

  const firstNameError = firstError("firstName");
  const lastNameError = firstError("lastName");
  const emailError = firstError("email");
  const dobError = firstError(
    "dateOfBirth",
    "dateOfBirth.day",
    "dateOfBirth.month",
    "dateOfBirth.year",
  );
  const phoneError = firstError("phone.e164", "phone.countryIso2", "phone");
  const salutationError = firstError("salutation");
  const formError = firstError("form");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-tap">
          <UserPlusIcon aria-hidden="true" />
          {ACTION_LABEL}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-dialog-max-h overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle className="text-console-title font-medium">
              {ACTION_LABEL}
            </DialogTitle>
            <DialogDescription>
              For someone who asked in person or by telephone. They are recorded
              exactly as the public form records a visitor.
            </DialogDescription>
          </DialogHeader>

          {notice && (
            <div
              ref={noticeRef}
              tabIndex={-1}
              role={notice.kind === "error" ? "alert" : "status"}
              aria-live="polite"
              className={
                notice.kind === "error"
                  ? "mt-4 flex items-start gap-2.5 rounded-(--radius-card) border border-danger-border bg-danger-wash px-3 py-2.5 text-danger-ink"
                  : "mt-4 flex items-start gap-2.5 rounded-(--radius-card) border border-border bg-surface-sunken px-3 py-2.5 text-text-secondary"
              }
            >
              {notice.kind === "error" ? (
                <TriangleAlertIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
              ) : (
                <InfoIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-text-muted"
                />
              )}
              <div className="min-w-0 text-console-body text-pretty">
                {notice.kind === "error" ? (
                  <>
                    <p className="font-medium">Nothing was saved</p>
                    <p className="mt-0.5 text-micro">
                      The server did not accept that entry. Check your
                      connection and press {ACTION_LABEL} again.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-text-primary">
                      Already on the waitlist
                    </p>
                    <p className="mt-0.5 text-micro">
                      <span className="font-data">{notice.email}</span> joined
                      earlier, so nothing was added and nothing was changed.
                      Close this, or correct the address if it was mistyped.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-4">
            {formError && (
              <p role="alert" className="text-micro font-medium text-danger">
                {formError}
              </p>
            )}

            <Field className="gap-2" data-invalid={Boolean(salutationError) || undefined}>
              <span className={LABEL_CLASS}>Title</span>
              <RadioGroup
                value={salutation}
                onValueChange={(next) => setSalutation(next as Salutation)}
                disabled={pending}
                aria-label="Title"
                className="grid w-fit grid-cols-2 gap-1 rounded-(--radius-card) border border-border bg-surface-raised p-1"
              >
                {SALUTATIONS.map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex min-h-tap cursor-pointer items-center justify-center rounded-(--radius-control) px-4 text-console-body text-text-secondary transition-colors select-none hover:text-text-primary has-[:checked]:bg-brand has-[:checked]:font-medium has-[:checked]:text-on-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand"
                  >
                    <RadioGroupItem value={value} className="sr-only" />
                    {label}
                  </label>
                ))}
              </RadioGroup>
              {salutationError && (
                <FieldError className={ERROR_CLASS}>{salutationError}</FieldError>
              )}
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field className="gap-2" data-invalid={Boolean(firstNameError) || undefined}>
                <FieldLabel htmlFor={`${ID}-first-name`} className={LABEL_CLASS}>
                  First name
                </FieldLabel>
                <Input
                  id={`${ID}-first-name`}
                  name="firstName"
                  placeholder="Sara"
                  autoComplete="off"
                  maxLength={NAME_MAX_LENGTH}
                  disabled={pending}
                  value={firstName}
                  onChange={(event) => {
                    setFirstName(event.target.value);
                    clearError("firstName");
                  }}
                  aria-invalid={Boolean(firstNameError) || undefined}
                  aria-describedby={firstNameError ? `${ID}-first-name-error` : undefined}
                  className={CONTROL_CLASS}
                />
                {firstNameError && (
                  <FieldError id={`${ID}-first-name-error`} className={ERROR_CLASS}>
                    {firstNameError}
                  </FieldError>
                )}
              </Field>

              <Field className="gap-2" data-invalid={Boolean(lastNameError) || undefined}>
                <FieldLabel htmlFor={`${ID}-last-name`} className={LABEL_CLASS}>
                  Last name
                </FieldLabel>
                <Input
                  id={`${ID}-last-name`}
                  name="lastName"
                  placeholder="Al Mansouri"
                  autoComplete="off"
                  maxLength={NAME_MAX_LENGTH}
                  disabled={pending}
                  value={lastName}
                  onChange={(event) => {
                    setLastName(event.target.value);
                    clearError("lastName");
                  }}
                  aria-invalid={Boolean(lastNameError) || undefined}
                  aria-describedby={lastNameError ? `${ID}-last-name-error` : undefined}
                  className={CONTROL_CLASS}
                />
                {lastNameError && (
                  <FieldError id={`${ID}-last-name-error`} className={ERROR_CLASS}>
                    {lastNameError}
                  </FieldError>
                )}
              </Field>
            </div>

            <Field className="gap-2" data-invalid={Boolean(emailError) || undefined}>
              <FieldLabel htmlFor={`${ID}-email`} className={LABEL_CLASS}>
                Email
              </FieldLabel>
              <Input
                id={`${ID}-email`}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                maxLength={EMAIL_MAX_LENGTH}
                placeholder="name@example.com"
                disabled={pending}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearError("email");
                  setNotice((current) =>
                    current?.kind === "duplicate" ? null : current,
                  );
                }}
                aria-invalid={Boolean(emailError) || undefined}
                aria-describedby={emailError ? `${ID}-email-error` : undefined}
                className={CONTROL_CLASS}
              />
              {emailError && (
                <FieldError id={`${ID}-email-error`} className={ERROR_CLASS}>
                  {emailError}
                </FieldError>
              )}
            </Field>

            <DobSelect
              id={`${ID}-dob`}
              label="Date of birth"
              minAge={minAge}
              maxAge={null}
              value={dob}
              onChange={(next) => {
                setDob(next);
                clearError(
                  "dateOfBirth",
                  "dateOfBirth.day",
                  "dateOfBirth.month",
                  "dateOfBirth.year",
                );
              }}
              error={dobError}
              disabled={pending}
              required
            />

            <PhoneInput
              id={`${ID}-phone`}
              label="Mobile number"
              value={phone}
              onChange={(next) => {
                setPhone(next);
                clearError("phone", "phone.e164", "phone.countryIso2");
              }}
              error={phoneError}
              disabled={pending}
              required
            />

            <p className="flex items-start gap-2 rounded-(--radius-card) bg-surface-sunken px-3 py-2.5 text-micro text-text-muted text-pretty">
              <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                No marketing consent is recorded for an entry added here, and
                consent cannot be given on someone else&apos;s behalf. They
                receive the waitlist confirmation and nothing else until they
                opt in themselves.
              </span>
            </p>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              className="h-tap px-4"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-tap px-4" disabled={pending}>
              {pending && (
                <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />
              )}
              {pending ? "Adding…" : ACTION_LABEL}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
