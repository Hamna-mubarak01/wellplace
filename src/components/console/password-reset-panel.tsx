"use client";

import { useActionState } from "react";
import {
  ArrowLeftIcon,
  LoaderCircleIcon,
  MailCheckIcon,
  MailIcon,
} from "lucide-react";

import {
  requestPasswordReset,
  type ResetResult,
} from "@/app/(console)/sign-in/actions";
import { AuthNotice } from "@/components/console/auth-notice";
import { Button } from "@/components/shared/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface PasswordResetPanelProps {
  onBack: () => void;
}

export function PasswordResetPanel({ onBack }: PasswordResetPanelProps) {
  const [state, action, pending] = useActionState<ResetResult, FormData>(
    requestPasswordReset,
    { status: "idle" },
  );

  if (state.status === "sent") {
    return (
      <div>
        <MailCheckIcon aria-hidden="true" className="size-6 text-success" />
        <h1 className="mt-4 text-console-title font-medium text-text-primary">
          Check your inbox
        </h1>
        <p className="mt-2 text-console-body text-text-secondary text-pretty">
          If that address has console access, a link to choose a new password is
          on its way. It works once and expires in 24 hours.
        </p>

        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="mt-5 -ml-2 h-tap"
        >
          <ArrowLeftIcon aria-hidden="true" />
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-console-label font-medium tracking-label text-text-muted uppercase">
        WellPlace console
      </p>
      <h1 className="mt-2 text-console-title font-medium text-text-primary">
        Reset your password
      </h1>
      <p className="mt-2 text-console-body text-text-secondary text-pretty">
        We will email you a link to choose a new one.
      </p>

      <form action={action} className="mt-6 flex flex-col gap-4">
        {state.status === "rate_limited" && (
          <AuthNotice tone="warning" title="Too many attempts">
            Wait a few minutes before asking for another link.
          </AuthNotice>
        )}
        {state.status === "error" && (
          <AuthNotice tone="danger" title="We couldn’t send that link">
            Try again in a moment.
          </AuthNotice>
        )}

        <Field className="gap-2" data-invalid={state.status === "invalid" || undefined}>
          <FieldLabel
            htmlFor="reset-email"
            className="gap-1 text-field-label font-medium text-text-secondary"
          >
            Work email
          </FieldLabel>
          <Input
            id="reset-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            disabled={pending}
            placeholder="name@wellplace.example"
            className="h-control w-full bg-surface-raised px-4"
          />
          {state.status === "invalid" && (
            <FieldError className="text-micro font-medium">
              {state.message}
            </FieldError>
          )}
        </Field>

        <Button
          type="submit"
          disabled={pending}
          className="h-control w-full text-control font-semibold"
        >
          {pending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : (
            <MailIcon aria-hidden="true" />
          )}
          {pending ? "Sending…" : "Email me a reset link"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="h-tap"
        >
          <ArrowLeftIcon aria-hidden="true" />
          Back to sign in
        </Button>
      </form>
    </div>
  );
}
