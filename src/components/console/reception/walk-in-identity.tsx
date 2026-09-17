"use client";

import { useEffect } from "react";
import { useReceptionValidation } from "@/components/console/reception/reception-validation";
import { RECEPTION_IDENTITY_LIMITS } from "@/lib/config/console-limits";

import {
  DobSelect,
  type DateOfBirthValue,
} from "@/components/shared/dob-select";
import { PhoneInput, type PhoneValue } from "@/components/shared/phone-input";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/console/reception/reception-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SALUTATIONS } from "@/lib/validation/waitlist";
import {
  CONTROL_CLASS,
  ERROR_CLASS,
  LABEL_CLASS,
  LEGEND_CLASS,
  SALUTATION_LABEL,
  fieldId,
  type Salutation,
} from "@/components/console/reception/walk-in-form";



export interface WalkInIdentityErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  dateOfBirth?: string;
  phone?: string;
}

export interface WalkInIdentityProps {
  salutation: Salutation;
  onSalutationChange: (next: Salutation) => void;
  firstName: string;
  onFirstNameChange: (next: string) => void;
  lastName: string;
  onLastNameChange: (next: string) => void;
  email: string;
  onEmailChange: (next: string) => void;
  dateOfBirth: DateOfBirthValue;
  onDateOfBirthChange: (next: DateOfBirthValue) => void;
  phone: PhoneValue;
  onPhoneChange: (next: PhoneValue) => void;
  bookerMinAge: number;
  disabled: boolean;
  dobDisabled?: boolean;
  errors: WalkInIdentityErrors;
}

export function WalkInIdentity({
  salutation,
  onSalutationChange,
  firstName,
  onFirstNameChange,
  lastName,
  onLastNameChange,
  email,
  onEmailChange,
  dateOfBirth,
  onDateOfBirthChange,
  phone,
  onPhoneChange,
  bookerMinAge,
  disabled,
  dobDisabled = disabled,
  errors,
}: WalkInIdentityProps) {
  const { errors: controlErrors, reject, clear } = useReceptionValidation();
  const phoneId = fieldId("phone");
  useEffect(() => () => clear(phoneId), [clear, phoneId]);
  return (
    <FieldSet className="gap-3">
      <FieldLegend className={LEGEND_CLASS}>Guest</FieldLegend>

      <Field className="gap-2">
        <span className={LABEL_CLASS}>Title</span>
        <RadioGroup
          id={fieldId("salutation")}
          value={salutation}
          onValueChange={(next) => onSalutationChange(next as Salutation)}
          disabled={disabled}
          aria-label="Title"
          className="grid w-fit grid-cols-2 gap-1 rounded-(--radius-card) border border-border bg-surface-raised p-1"
        >
          {SALUTATIONS.map((value) => (
            <label
              key={value}
              className="flex min-h-tap cursor-pointer items-center justify-center rounded-(--radius-control) px-4 text-console-body text-text-secondary transition-colors select-none hover:text-text-primary has-[:checked]:bg-brand has-[:checked]:font-medium has-[:checked]:text-on-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand"
            >
              <RadioGroupItem value={value} className="sr-only" />
              {SALUTATION_LABEL[value]}
            </label>
          ))}
        </RadioGroup>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field className="gap-2" data-invalid={Boolean(errors.firstName) || undefined}>
          <FieldLabel htmlFor={fieldId("first-name")} className={LABEL_CLASS}>
            First name
          </FieldLabel>
          <Input
            id={fieldId("first-name")}
            name="firstName"
            required
            autoComplete="off"
            maxLength={RECEPTION_IDENTITY_LIMITS.nameMaxLength}
            disabled={disabled}
            value={firstName}
            onChange={(event) => onFirstNameChange(event.target.value)}
            aria-invalid={Boolean(errors.firstName) || undefined}
            aria-describedby={errors.firstName ? fieldId("first-name-error") : undefined}
            className={CONTROL_CLASS}
          />
          {errors.firstName && (
            <FieldError id={fieldId("first-name-error")} className={ERROR_CLASS}>
              {errors.firstName}
            </FieldError>
          )}
        </Field>

        <Field className="gap-2" data-invalid={Boolean(errors.lastName) || undefined}>
          <FieldLabel htmlFor={fieldId("last-name")} className={LABEL_CLASS}>
            Last name
          </FieldLabel>
          <Input
            id={fieldId("last-name")}
            name="lastName"
            required
            autoComplete="off"
            maxLength={RECEPTION_IDENTITY_LIMITS.nameMaxLength}
            disabled={disabled}
            value={lastName}
            onChange={(event) => onLastNameChange(event.target.value)}
            aria-invalid={Boolean(errors.lastName) || undefined}
            aria-describedby={errors.lastName ? fieldId("last-name-error") : undefined}
            className={CONTROL_CLASS}
          />
          {errors.lastName && (
            <FieldError id={fieldId("last-name-error")} className={ERROR_CLASS}>
              {errors.lastName}
            </FieldError>
          )}
        </Field>
      </div>

      <Field className="gap-2" data-invalid={Boolean(errors.email) || undefined}>
        <FieldLabel htmlFor={fieldId("email")} className={LABEL_CLASS}>
          Email
        </FieldLabel>
        <Input
          id={fieldId("email")}
          name="email"
            required
          type="email"
          inputMode="email"
          autoComplete="off"
          maxLength={RECEPTION_IDENTITY_LIMITS.emailMaxLength}
          placeholder="name@example.com"
          disabled={disabled}
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          aria-invalid={Boolean(errors.email) || undefined}
          aria-describedby={errors.email ? fieldId("email-error") : undefined}
          className={CONTROL_CLASS}
        />
        {errors.email && (
          <FieldError id={fieldId("email-error")} className={ERROR_CLASS}>
            {errors.email}
          </FieldError>
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DobSelect
          id={fieldId("dob")}
          label="Date of birth"
          minAge={bookerMinAge}
          maxAge={null}
          value={dateOfBirth}
          onChange={onDateOfBirthChange}
          error={errors.dateOfBirth}
          disabled={dobDisabled}
          required
        />

        <PhoneInput
          id={fieldId("phone")}
          label="Mobile number"
          value={phone}
          onChange={(next) => {
            if (`${next.dialCode}${next.nationalNumber}`.replace(/\D/g, "").length > RECEPTION_IDENTITY_LIMITS.phoneMaxDigits) {
              reject(phoneId, `Use no more than ${RECEPTION_IDENTITY_LIMITS.phoneMaxDigits} digits, including the country code.`);
              return;
            }
            clear(phoneId);
            onPhoneChange(next);
          }}
          error={controlErrors[phoneId] ?? errors.phone}
          disabled={disabled}
          required
        />
      </div>
    </FieldSet>
  );
}
