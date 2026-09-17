"use client";

import { useActionState } from "react";
import { KeyRoundIcon, LoaderCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import {
  setPassword,
  type SetPasswordResult,
} from "@/app/(console)/set-password/actions";
import { AuthNotice } from "@/components/console/auth-notice";
import { PasswordField } from "@/components/console/password-field";
import { Button } from "@/components/shared/button";

export function SetPasswordForm({ className }: { className?: string }) {
  const [state, action, pending] = useActionState<SetPasswordResult, FormData>(
    setPassword,
    { status: "idle" },
  );

  return (
    <form action={action} className={cn("flex flex-col gap-4", className)}>
      {state.status === "expired" && (
        <AuthNotice tone="danger" title="That link has expired">
          Open the console and use “Forgot your password?” to send a new one.
        </AuthNotice>
      )}

      {state.status === "error" && (
        <AuthNotice tone="danger" title="We couldn’t save that password">
          Try again in a moment.
        </AuthNotice>
      )}

      <PasswordField
        id="new-password"
        name="password"
        label="New password"
        autoComplete="new-password"
        autoFocus
        required
        minLength={MIN_PASSWORD_LENGTH}
        disabled={pending}
        description={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      />

      <PasswordField
        id="confirm-password"
        name="confirm"
        label="Confirm password"
        autoComplete="new-password"
        required
        disabled={pending}
        error={state.status === "invalid" ? state.message : undefined}
      />

      <Button
        type="submit"
        disabled={pending}
        className="mt-1 h-control w-full text-control font-semibold"
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : (
          <KeyRoundIcon aria-hidden="true" />
        )}
        {pending ? "Saving…" : "Save password and continue"}
      </Button>
    </form>
  );
}
