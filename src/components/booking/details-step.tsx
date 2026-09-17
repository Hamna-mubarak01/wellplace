"use client";

import { RECEPTION_IDENTITY_LIMITS } from "@/lib/config/console-limits";
import type { BookingDetails, DetailsField, Salutation } from "@/components/booking/booking-details";
import { DobSelect } from "@/components/shared/dob-select";
import { PhoneInput } from "@/components/shared/phone-input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";


const SALUTATIONS = [
  { value: "mr", label: "Mr." },
  { value: "ms", label: "Ms." },
] as const;

const LABEL_CLASS = "gap-1 text-field-label font-medium text-text-secondary";
const CONTROL_CLASS =
  "h-control w-full rounded-(--radius-card) bg-surface-raised px-4 text-control";
const ERROR_CLASS = "text-micro font-medium";

export interface DetailsStepProps {
  details: BookingDetails;
  onChange: (details: BookingDetails) => void;
  bookerMinAge: number;
  errors: Partial<Record<DetailsField, string>>;
  onBlurField: (field: DetailsField, next?: BookingDetails) => void;
  disabled?: boolean;
}

export function DetailsStep({
  details,
  onChange,
  bookerMinAge,
  errors,
  onBlurField,
  disabled = false,
}: DetailsStepProps) {
  const set = <K extends keyof BookingDetails>(key: K, value: BookingDetails[K]) =>
    onChange({ ...details, [key]: value });

  return (
    <div className="flex flex-col gap-5">
      <Field
        className="gap-1.5"
        data-invalid={Boolean(errors.salutation) || undefined}
      >
        <FieldLabel asChild className={LABEL_CLASS}>
          <span>Title</span>
        </FieldLabel>
        <RadioGroup
          value={details.salutation ?? ""}
          onValueChange={(next) => {
            const updated = { ...details, salutation: next as Salutation };
            onChange(updated);
            onBlurField("salutation", updated);
          }}
          disabled={disabled}
          aria-label="Title"
          aria-invalid={Boolean(errors.salutation) || undefined}
          aria-describedby={errors.salutation ? "book-salutation-error" : undefined}
          className="grid w-full max-w-toggle grid-cols-2 gap-1 rounded-(--radius-card) border border-border bg-surface-raised p-1"
        >
          {SALUTATIONS.map(({ value, label }) => (
            <label
              key={value}
              className={cn(
                "relative flex min-h-tap cursor-pointer items-center justify-center rounded-(--radius-control) px-6 text-option transition-colors duration-150 select-none",
                "text-text-secondary hover:text-text-primary",
                "has-[[data-state=checked]]:bg-brand has-[[data-state=checked]]:font-medium has-[[data-state=checked]]:text-on-brand",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <RadioGroupItem value={value} className="sr-only" />
              {label}
            </label>
          ))}
        </RadioGroup>
        {errors.salutation ? (
          <FieldError id="book-salutation-error" className={ERROR_CLASS}>
            {errors.salutation}
          </FieldError>
        ) : null}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field className="gap-1.5" data-invalid={Boolean(errors.firstName) || undefined}>
          <FieldLabel htmlFor="book-first-name" className={LABEL_CLASS}>
            First name
          </FieldLabel>
          <Input
            id="book-first-name"
            maxLength={RECEPTION_IDENTITY_LIMITS.nameMaxLength}
            placeholder="Your first name"
            name="given-name"
            autoComplete="given-name"
            value={details.firstName}
            disabled={disabled}
            onChange={(event) => set("firstName", event.target.value)}
            onBlur={() => onBlurField("firstName")}
            aria-invalid={Boolean(errors.firstName) || undefined}
            aria-describedby={errors.firstName ? "book-first-name-error" : undefined}
            className={CONTROL_CLASS}
          />
          {errors.firstName ? (
            <FieldError id="book-first-name-error" className={ERROR_CLASS}>
              {errors.firstName}
            </FieldError>
          ) : null}
        </Field>

        <Field className="gap-1.5" data-invalid={Boolean(errors.lastName) || undefined}>
          <FieldLabel htmlFor="book-last-name" className={LABEL_CLASS}>
            Last name
          </FieldLabel>
          <Input
            id="book-last-name"
            maxLength={RECEPTION_IDENTITY_LIMITS.nameMaxLength}
            placeholder="Your last name"
            name="family-name"
            autoComplete="family-name"
            value={details.lastName}
            disabled={disabled}
            onChange={(event) => set("lastName", event.target.value)}
            onBlur={() => onBlurField("lastName")}
            aria-invalid={Boolean(errors.lastName) || undefined}
            aria-describedby={errors.lastName ? "book-last-name-error" : undefined}
            className={CONTROL_CLASS}
          />
          {errors.lastName ? (
            <FieldError id="book-last-name-error" className={ERROR_CLASS}>
              {errors.lastName}
            </FieldError>
          ) : null}
        </Field>
      </div>

      <DobSelect
        id="book-dob"
        label="Date of birth"
        minAge={bookerMinAge}
        maxAge={null}
        required
        disabled={disabled}
        value={details.dateOfBirth}
        onChange={(value) => {
          const updated = { ...details, dateOfBirth: value };
          onChange(updated);
          if (value.day !== null && value.month !== null && value.year !== null) {
            onBlurField("dateOfBirth", updated);
          }
        }}
        error={errors.dateOfBirth}
      />

      <Field className="gap-1.5" data-invalid={Boolean(errors.email) || undefined}>
        <FieldLabel htmlFor="book-email" className={LABEL_CLASS}>
          Email
        </FieldLabel>
        <Input
          id="book-email"
          maxLength={RECEPTION_IDENTITY_LIMITS.emailMaxLength}
            placeholder="you@example.com"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={details.email}
          disabled={disabled}
          onChange={(event) => set("email", event.target.value)}
          onBlur={() => onBlurField("email")}
          aria-invalid={Boolean(errors.email) || undefined}
          aria-describedby={errors.email ? "book-email-error" : undefined}
          className={CONTROL_CLASS}
        />
        {errors.email ? (
          <FieldError id="book-email-error" className={ERROR_CLASS}>
            {errors.email}
          </FieldError>
        ) : null}
      </Field>

      <div onBlur={() => onBlurField("phone")}>
        <PhoneInput
          id="book-phone"
          label="Mobile number"
          required
          disabled={disabled}
          value={details.phone}
          onChange={(value) => set("phone", value)}
          error={errors.phone}
        />
      </div>
    </div>
  );
}
