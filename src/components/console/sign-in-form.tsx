"use client";

import { useActionState, useState } from "react";
import { LoaderCircleIcon, LogInIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { signIn, type SignInResult } from "@/app/(console)/sign-in/actions";
import { AuthNotice } from "@/components/console/auth-notice";
import { PasswordField } from "@/components/console/password-field";
import { PasswordResetPanel } from "@/components/console/password-reset-panel";
import { Button } from "@/components/shared/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface SignInFormProps {
  linkError?: "link_expired" | "link_invalid";
  className?: string;
}

export function SignInForm({ linkError, className }: SignInFormProps) {
  const [mode, setMode] = useState<"password" | "reset">("password");

  const [signInState, signInAction, signingIn] = useActionState<SignInResult, FormData>(
    signIn,
    { status: "idle" },
  );

  if (mode === "reset") {
    return (
      <div className={className}>
        <PasswordResetPanel onBack={() => setMode("password")} />
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      <p className="text-console-label font-medium tracking-label text-text-muted uppercase">
        WellPlace console
      </p>
      <h1 className="mt-2 text-console-title font-medium text-text-primary">
        Sign in to the console
      </h1>
      <p className="mt-2 text-console-body text-text-secondary text-pretty">
        Reception and Management share this sign-in. Use the email address your
        invitation was sent to, and you will land in the console your account is
        for.
      </p>

      <form action={signInAction} className="mt-6 flex flex-col gap-4">
        {linkError && (
          <AuthNotice
            tone="danger"
            title={
              linkError === "link_expired"
                ? "That link has expired"
                : "That link did not work"
            }
          >
            Sign in below, or use “Forgot your password?” to send yourself a new
            one.
          </AuthNotice>
        )}

        {signInState.status === "rejected" && (
          <AuthNotice tone="danger" title="That email and password don’t match">
            Check both and try again. If you have never set a password, use
            “Forgot your password?” below.
          </AuthNotice>
        )}

        {signInState.status === "deactivated" && (
          <AuthNotice tone="warning" title="This account has been turned off">
            Your console access was deactivated. Ask someone with Management
            access to turn it back on, then sign in again.
          </AuthNotice>
        )}

        {signInState.status === "rate_limited" && (
          <AuthNotice tone="warning" title="Too many attempts">
            Wait a few minutes before trying again.
          </AuthNotice>
        )}

        {signInState.status === "error" && (
          <AuthNotice tone="danger" title="We couldn’t sign you in">
            Something went wrong on our side. Try again in a moment.
          </AuthNotice>
        )}

        <Field className="gap-2" data-invalid={signInState.status === "invalid" || undefined}>
          <FieldLabel
            htmlFor="console-email"
            className="gap-1 text-field-label font-medium text-text-secondary"
          >
            Work email
          </FieldLabel>
          <Input
            id="console-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoFocus
            required
            disabled={signingIn}
            placeholder="name@wellplace.example"
            className="h-control w-full bg-surface-raised px-4"
          />
        </Field>

        <PasswordField
          id="console-password"
          name="password"
          label="Password"
          autoComplete="current-password"
          required
          disabled={signingIn}
          error={
            signInState.status === "invalid" ? signInState.message : undefined
          }
        />

        <Button
          type="submit"
          disabled={signingIn}
          className="mt-1 h-control w-full text-control font-semibold"
        >
          {signingIn ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : (
            <LogInIcon aria-hidden="true" />
          )}
          {signingIn ? "Signing in…" : "Sign in"}
        </Button>

        <Button
          type="button"
          variant="link"
          onClick={() => setMode("reset")}
          className="h-tap self-center text-console-body"
        >
          Forgot your password?
        </Button>
      </form>
    </div>
  );
}
