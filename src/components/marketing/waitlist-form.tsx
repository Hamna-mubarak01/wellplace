"use client";

import { useRef, useState, useTransition } from "react";
import {
  CheckIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { useCelebrationConfetti } from "@/components/marketing/celebration-confetti";
import { cn } from "@/lib/utils";
import {
  waitlistSubmissionSchema,
  type WaitlistSubmission,
} from "@/lib/validation/waitlist";
import { submitWaitlistEntry } from "@/app/(site)/waitlist/actions";
import type { WaitlistResult } from "@/app/(site)/waitlist/actions-types";
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
import { TermsAcceptanceField } from "@/components/shared/terms-acceptance-field";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Salutation = "" | WaitlistSubmission["salutation"];
type Status = WaitlistResult["status"] | "idle";

const FIELD_CLASS = "gap-1.5";
const LABEL_CLASS =
  "gap-1 text-field-label font-medium text-text-secondary";
const CONTROL_CLASS = "h-control rounded-(--radius-card) text-control w-full bg-surface-raised px-4";
const ERROR_CLASS = "text-micro font-medium";
function readAttribution(): WaitlistSubmission["attribution"] {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const pick = (key: string) => params.get(key)?.trim() || undefined;
  return {
    source: pick("source"),
    referrer: document.referrer || undefined,
    utmSource: pick("utm_source"),
    utmMedium: pick("utm_medium"),
    utmCampaign: pick("utm_campaign"),
    utmContent: pick("utm_content"),
    utmTerm: pick("utm_term"),
  };
}

function announce(status: WaitlistResult["status"]) {
  switch (status) {
    case "already_on_list":
      toast.info("You're already on the list", {
        description:
          "This email address has already joined the waitlist — we'll be in touch when WellPlace opens.",
      });
      break;
    case "rate_limited":
      toast.warning("Too many attempts", {
        description: "Wait a few minutes, then try again.",
      });
      break;
    case "error":
      toast.error("Something went wrong", {
        description:
          "We couldn't save your details just now. Check your connection and try again.",
      });
      break;
    case "invalid":
      toast.error("Please complete the highlighted fields to join", {
        description: "We've marked what still needs your attention.",
      });
      break;
    default:
      break;
  }
}

function SuccessPanel({
  email,
  className,
}: {
  email: string;
  className?: string;
}) {
  useCelebrationConfetti();

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative flex flex-col items-center text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500 motion-safe:ease-out",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-(--shadow-md)"
      >
        <CheckIcon className="size-7" />
      </span>
      <h1 className="mt-7 font-display text-subhead font-medium tracking-display text-text-primary">
        You&apos;re on the{" "}
        <em className="font-accent font-medium text-brand italic">list</em>
      </h1>
      <p className="mt-3.5 max-w-lead text-body text-text-secondary text-pretty">
        We&apos;ve saved your place on the founding waitlist. We&apos;ll write
        once — when booking opens.
      </p>

      {email && (
        <p className="mt-7 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-micro text-text-muted">
          <span className="tracking-label uppercase">Confirmation to</span>
          <span className="font-data text-option text-text-secondary">
            {email}
          </span>
        </p>
      )}
    </div>
  );
}

function groupIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    const path = issue.path.join(".") || "form";
    (errors[path] ??= []).push(issue.message);
  }
  return errors;
}

export interface WaitlistFormProps {
  className?: string;
  heading?: React.ReactNode;
  minAge: number;
}

const SALUTATIONS = [
  { value: "mr", label: "Mr." },
  { value: "ms", label: "Ms." },
] as const;

export function WaitlistForm({ className, heading, minAge }: WaitlistFormProps) {
  const [salutation, setSalutation] = useState<Salutation>("mr");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState<DateOfBirthValue>(EMPTY_DOB);
  const [phone, setPhone] = useState<PhoneValue>(() => emptyPhoneValue());
  const [website, setWebsite] = useState("");
  const [attribution] = useState(readAttribution);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [isPending, startTransition] = useTransition();
  const summaryRef = useRef<HTMLDivElement>(null);
  const termsRef = useRef<HTMLButtonElement>(null);

  function firstError(...keys: string[]): string | undefined {
    for (const key of keys) {
      const messages = fieldErrors[key];
      if (messages?.length) return messages[0];
    }
    return undefined;
  }

  function validateRequired(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    if (!salutation) errors.salutation = ["Select Mr. or Ms."];
    if (!firstName.trim()) errors.firstName = ["Enter your first name."];
    if (!lastName.trim()) errors.lastName = ["Enter your last name."];
    if (!email.trim()) {
      errors.email = ["Enter an email address we can reach you on."];
    }
    if (dob.day === null || dob.month === null || dob.year === null) {
      errors.dateOfBirth = ["Choose your date of birth."];
    } else {
      const age = calculateAge(dob);
      if (age !== null && age < minAge) {
        errors.dateOfBirth = [
          `You need to be at least ${minAge} to join the waitlist.`,
        ];
      }
    }
    if (!phone.nationalNumber.trim()) {
      errors["phone.e164"] = ["Enter a mobile number including the area code."];
    }
    if (!termsAccepted) {
      errors.termsAccepted = [
        "Tick this box to accept the terms and join the waitlist.",
      ];
    }
    return errors;
  }

  function buildPayload(): unknown {
    return {
      salutation: salutation || undefined,
      firstName,
      lastName,
      email: email.trim(),
      dateOfBirth: {
        day: dob.day ?? undefined,
        month: dob.month ?? undefined,
        year: dob.year ?? undefined,
      },
      phone: {
        e164: toE164(phone),
        countryIso2: phone.countryIso2,
      },
      attribution,
      termsAccepted,
      website,
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const requiredErrors = validateRequired();
    if (Object.keys(requiredErrors).length > 0) {
      setFieldErrors(requiredErrors);
      setStatus("invalid");
      announce("invalid");
      if (
        Object.keys(requiredErrors).length === 1 &&
        requiredErrors.termsAccepted
      ) {
        termsRef.current?.focus();
      }
      return;
    }

    const parsed = waitlistSubmissionSchema.safeParse(buildPayload());
    if (!parsed.success) {
      setFieldErrors(groupIssues(parsed.error.issues));
      setStatus("invalid");
      return;
    }

    setFieldErrors({});
    startTransition(async () => {
      const result = await submitWaitlistEntry(parsed.data);
      setFieldErrors(result.status === "invalid" ? result.fieldErrors : {});
      setStatus(result.status);
      announce(result.status);
      if (result.status === "invalid") summaryRef.current?.focus();
    });
  }

  if (status === "joined") {
    return <SuccessPanel email={email} />;
  }

  const salutationError = firstError("salutation");
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
  const termsError = firstError("termsAccepted");

  return (
    <div>
      {heading}
      <div className={className}>
        <form
          method="post"
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-(--space-field-gap)"
        >
          <div aria-hidden="true" className="h-0 w-0 overflow-hidden opacity-0">
            <label htmlFor="wl-website">Leave this field blank</label>
            <input
              id="wl-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
          <Field
            className={FIELD_CLASS}
            data-invalid={Boolean(salutationError) || undefined}
          >
            <FieldLabel asChild className={LABEL_CLASS}>
              <span>
                Title
              </span>
            </FieldLabel>
            <RadioGroup
              value={salutation}
              onValueChange={(next) => setSalutation(next as Salutation)}
              disabled={isPending}
              aria-label="Title"
              aria-invalid={Boolean(salutationError) || undefined}
              aria-describedby={
                salutationError ? "wl-salutation-error" : undefined
              }
              className="grid w-full max-w-72 grid-cols-2 gap-1 rounded-(--radius-card) border border-border-interactive bg-surface-raised p-1"
            >
              {SALUTATIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className={cn(
                    "relative flex cursor-pointer items-center justify-center rounded-[calc(var(--radius-card)-0.25rem)] px-6 py-2 text-option transition-colors select-none",
                    "text-text-secondary hover:text-text-primary",
                    "has-[:checked]:bg-brand has-[:checked]:text-on-brand has-[:checked]:font-medium",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
                    isPending && "pointer-events-none opacity-60",
                  )}
                >
                  <RadioGroupItem value={value} className="sr-only" />
                  {label}
                </label>
              ))}
            </RadioGroup>
            {salutationError && (
              <FieldError id="wl-salutation-error" className={ERROR_CLASS}>
                {salutationError}
              </FieldError>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-(--space-field-gap)">
            <Field
              className={cn(FIELD_CLASS, "flex-1")}
              data-invalid={Boolean(firstNameError) || undefined}
            >
              <FieldLabel htmlFor="wl-first-name" className={LABEL_CLASS}>
                First name
              </FieldLabel>
              <Input
                id="wl-first-name"
                autoComplete="given-name"
                placeholder="Sara"
                required
                disabled={isPending}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                aria-invalid={Boolean(firstNameError) || undefined}
                aria-describedby={
                  firstNameError ? "wl-first-name-error" : undefined
                }
                className={CONTROL_CLASS}
              />
              {firstNameError && (
                <FieldError id="wl-first-name-error" className={ERROR_CLASS}>
                  {firstNameError}
                </FieldError>
              )}
            </Field>
            <Field
              className={FIELD_CLASS}
              data-invalid={Boolean(lastNameError) || undefined}
            >
            <FieldLabel htmlFor="wl-last-name" className={LABEL_CLASS}>
              Last name
            </FieldLabel>
            <Input
              id="wl-last-name"
              autoComplete="family-name"
              placeholder="Al Mansouri"
              required
              disabled={isPending}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              aria-invalid={Boolean(lastNameError) || undefined}
              aria-describedby={lastNameError ? "wl-last-name-error" : undefined}
              className={CONTROL_CLASS}
            />
              {lastNameError && (
                <FieldError id="wl-last-name-error" className={ERROR_CLASS}>
                  {lastNameError}
                </FieldError>
              )}
            </Field>
          </div>
          <Field
            className={FIELD_CLASS}
            data-invalid={Boolean(emailError) || undefined}
          >
            <FieldLabel htmlFor="wl-email" className={LABEL_CLASS}>
              Email
            </FieldLabel>
            <Input
              id="wl-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              required
              disabled={isPending}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(emailError) || undefined}
              aria-describedby={emailError ? "wl-email-error" : undefined}
              className={CONTROL_CLASS}
            />
            {emailError && (
              <FieldError id="wl-email-error" className={ERROR_CLASS}>
                {emailError}
              </FieldError>
            )}
          </Field>
          <DobSelect
            id="wl-dob"
            label="Date of birth"
            minAge={minAge}
            maxAge={null}
            value={dob}
            onChange={(next) => setDob(next)}
            error={dobError}
            disabled={isPending}
            required
          />
          <PhoneInput
            id="wl-phone"
            label="Mobile number"
            value={phone}
            onChange={setPhone}
            error={phoneError}
            disabled={isPending}
            required
          />
          <div className="flex flex-col gap-2.5">
            <TermsAcceptanceField
              id="wl-terms-accepted"
              checkboxRef={termsRef}
              checked={termsAccepted}
              onCheckedChange={(checked) => {
                const next = checked === true;
                setTermsAccepted(next);
                if (next) {
                  setFieldErrors((current) => {
                    if (!current.termsAccepted) return current;
                    const remaining = { ...current };
                    delete remaining.termsAccepted;
                    return remaining;
                  });
                }
              }}
              disabled={isPending}
              error={termsError}
            />
            <Button
              type="submit"
              disabled={isPending}
              className="w-full font-semibold"
            >
              {isPending && (
                <Loader2Icon aria-hidden="true" className="animate-spin" />
              )}
              {isPending ? "Joining…" : "Join the waitlist"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
