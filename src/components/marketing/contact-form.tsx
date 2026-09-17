"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowRightIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { submitContactEnquiry } from "@/app/(site)/contact/actions";
import { useCelebrationConfetti } from "@/components/marketing/celebration-confetti";
import type { ContactResult } from "@/app/(site)/contact/actions-types";
import { Button } from "@/components/shared/button";
import { TermsAcceptanceField } from "@/components/shared/terms-acceptance-field";
import {
  PhoneInput,
  emptyPhoneValue,
  toE164,
  type PhoneValue,
} from "@/components/shared/phone-input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ResolvedContactForm } from "@/lib/config/cms/contact-content";
import { contactSubmissionSchema } from "@/lib/validation/contact";

type Status = ContactResult["status"] | "idle";

const FIELD_CLASS = "gap-1.5";
const LABEL_CLASS = "font-data text-micro font-medium tracking-label text-text-secondary uppercase";
const CONTROL_CLASS =
  "h-control w-full rounded-(--radius-card) border-border-interactive bg-surface-raised px-4 text-control";

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

function announce(status: ContactResult["status"], copy: ResolvedContactForm) {
  if (status === "sent") {
    toast.success(copy.sentTitle, { description: copy.sentBody });
  } else if (status === "rate_limited") {
    toast.warning(copy.rateLimitedTitle, { description: copy.rateLimitedBody });
  } else if (status === "error") {
    toast.error(copy.errorTitle, { description: copy.errorBody });
  }
}

function ContactSuccessPanel({
  copy,
  onReset,
}: {
  copy: ResolvedContactForm;
  onReset: () => void;
}) {
  useCelebrationConfetti();

  return (
    <Card className="h-full gap-0 border border-border bg-surface-raised py-0 shadow-(--shadow-lg)">
      <CardContent
        role="status"
        aria-live="polite"
        className="flex min-h-reservation-min-h flex-col items-center justify-center px-6 py-12 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500 motion-safe:ease-out sm:px-10"
      >
        <span className="grid size-14 place-items-center rounded-full bg-brand text-on-brand shadow-(--shadow-md)">
          <CheckIcon aria-hidden="true" className="size-7" />
        </span>
        <h2 className="mt-6 font-display text-h2 tracking-display text-text-primary text-balance">
          {copy.successHeading}
        </h2>
        <p className="mt-3 max-w-measure text-body text-text-secondary text-pretty">
          {copy.successDescription}
        </p>
        <Button type="button" variant="outline" className="mt-7" onClick={onReset}>
          {copy.resetLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ContactForm({ copy }: { copy: ResolvedContactForm }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<PhoneValue>(() => emptyPhoneValue());
  const [message, setMessage] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();
  const summaryRef = useRef<HTMLDivElement>(null);

  function firstError(...keys: string[]): string | undefined {
    for (const key of keys) {
      const error = fieldErrors[key]?.[0];
      if (error) return error;
    }
    return undefined;
  }

  function resetForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone(emptyPhoneValue());
    setMessage("");
    setTermsAccepted(false);
    setWebsite("");
    setFieldErrors({});
    setStatus("idle");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const payload = {
      firstName,
      lastName,
      email,
      phone: { e164: toE164(phone), countryIso2: phone.countryIso2 },
      message,
      termsAccepted,
      website,
    };
    const parsed = contactSubmissionSchema.safeParse({ ...payload, website: "" });
    if (!parsed.success) {
      setFieldErrors(groupIssues(parsed.error.issues));
      setStatus("invalid");
      summaryRef.current?.focus();
      return;
    }

    setFieldErrors({});
    startTransition(async () => {
      const result = await submitContactEnquiry(payload);
      setFieldErrors(result.status === "invalid" ? result.fieldErrors : {});
      setStatus(result.status);
      announce(result.status, copy);
      if (result.status === "invalid") summaryRef.current?.focus();
    });
  }

  if (status === "sent") {
    return <ContactSuccessPanel copy={copy} onReset={resetForm} />;
  }

  const firstNameError = firstError("firstName");
  const lastNameError = firstError("lastName");
  const emailError = firstError("email");
  const phoneError = firstError("phone", "phone.e164", "phone.countryIso2");
  const messageError = firstError("message");
  const termsError = firstError("termsAccepted");

  return (
    <Card className="h-full gap-0 border border-border bg-surface-raised py-0 shadow-(--shadow-lg)">
      <CardHeader className="border-b border-border px-5 py-6 sm:px-8 sm:py-7">
        <h2 className="font-display text-h2 tracking-display text-text-primary">
          {copy.heading}
        </h2>
        <p className="mt-1 text-small text-text-secondary">
          {copy.description}
        </p>
      </CardHeader>
      <CardContent className="px-5 py-6 sm:px-8 sm:py-8">
        <form method="post" noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div aria-hidden="true" className="h-0 w-0 overflow-hidden opacity-0">
            <label htmlFor="contact-website">Leave this field blank</label>
            <input
              id="contact-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          {status === "invalid" && (
            <div
              ref={summaryRef}
              role="alert"
              tabIndex={-1}
              className="rounded-(--radius-card) border border-danger/30 bg-danger-wash px-4 py-3 text-small text-danger-ink outline-none"
            >
              {copy.invalidBanner}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field className={FIELD_CLASS} data-invalid={Boolean(firstNameError) || undefined}>
              <FieldLabel htmlFor="contact-first-name" className={LABEL_CLASS}>
                {copy.firstNameLabel}
              </FieldLabel>
              <Input
                id="contact-first-name"
                name="firstName"
                autoComplete="given-name"
                placeholder={copy.firstNamePlaceholder}
                required
                disabled={isPending}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                aria-invalid={Boolean(firstNameError) || undefined}
                aria-describedby={firstNameError ? "contact-first-name-error" : undefined}
                className={CONTROL_CLASS}
              />
              {firstNameError && (
                <FieldError id="contact-first-name-error" className="text-micro font-medium">
                  {firstNameError}
                </FieldError>
              )}
            </Field>

            <Field className={FIELD_CLASS} data-invalid={Boolean(lastNameError) || undefined}>
              <FieldLabel htmlFor="contact-last-name" className={LABEL_CLASS}>
                {copy.lastNameLabel}
              </FieldLabel>
              <Input
                id="contact-last-name"
                name="lastName"
                autoComplete="family-name"
                placeholder={copy.lastNamePlaceholder}
                required
                disabled={isPending}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                aria-invalid={Boolean(lastNameError) || undefined}
                aria-describedby={lastNameError ? "contact-last-name-error" : undefined}
                className={CONTROL_CLASS}
              />
              {lastNameError && (
                <FieldError id="contact-last-name-error" className="text-micro font-medium">
                  {lastNameError}
                </FieldError>
              )}
            </Field>
          </div>

          <Field className={FIELD_CLASS} data-invalid={Boolean(emailError) || undefined}>
            <FieldLabel htmlFor="contact-email" className={LABEL_CLASS}>
              {copy.emailLabel}
            </FieldLabel>
            <Input
              id="contact-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={copy.emailPlaceholder}
              required
              disabled={isPending}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(emailError) || undefined}
              aria-describedby={emailError ? "contact-email-error" : undefined}
              className={CONTROL_CLASS}
            />
            {emailError && (
              <FieldError id="contact-email-error" className="text-micro font-medium">
                {emailError}
              </FieldError>
            )}
          </Field>

          <PhoneInput
            id="contact-phone"
            label={copy.phoneLabel}
            value={phone}
            onChange={setPhone}
            error={phoneError}
            disabled={isPending}
            className={FIELD_CLASS}
          />

          <Field className={FIELD_CLASS} data-invalid={Boolean(messageError) || undefined}>
            <FieldLabel htmlFor="contact-message" className={LABEL_CLASS}>
              {copy.messageLabel}
            </FieldLabel>
            <Textarea
              id="contact-message"
              name="message"
              placeholder={copy.messagePlaceholder}
              required
              disabled={isPending}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              aria-invalid={Boolean(messageError) || undefined}
              aria-describedby={messageError ? "contact-message-error" : undefined}
              className="min-h-32 resize-y rounded-(--radius-card) border-border-interactive bg-surface-raised px-4 py-3 text-control"
            />
            {messageError && (
              <FieldError id="contact-message-error" className="text-micro font-medium">
                {messageError}
              </FieldError>
            )}
          </Field>

          <TermsAcceptanceField
            id="contact-terms-accepted"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
            disabled={isPending}
            error={termsError}
          />

          <Button type="submit" tone="brand" size="lg" disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2Icon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                {copy.pendingLabel}
              </>
            ) : (
              <>
                {copy.submitLabel}
                <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
