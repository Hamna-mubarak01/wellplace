"use client";

import { STAFF_INPUT_LIMITS } from "@/lib/config/staff-access";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "@/lib/console/feedback";

import { CheckIcon, LoaderCircleIcon, UserPlusIcon } from "lucide-react";

import { inviteMember } from "@/app/(console)/manage/staff/actions";
import { inviteLinkLifetimeLabel } from "@/lib/config/staff-access";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const LABEL = "text-field-label font-medium text-text-secondary";

const CONTROL = "h-tap w-full rounded-(--radius-card) bg-surface-raised px-3 text-console-body";

const ROLE_CARD =
  "flex h-full cursor-pointer items-start gap-3 rounded-(--radius-card) border border-border bg-surface-raised p-3 font-normal transition-colors hover:bg-surface-hover has-data-checked:border-brand has-data-checked:bg-surface-active";

const SUCCESS_DWELL_MS = 3200;

export function InviteMemberDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"reception" | "management">("reception");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dismissTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
    },
    [],
  );

  function reset() {
    if (dismissTimer.current !== null) {
      window.clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    setSentTo(null);
    setRole("reception");
  }

  function submit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    start(async () => {
      try {
        const result = await inviteMember({
          email,
          fullName: String(formData.get("fullName") ?? ""),
          role,
        });

        if (result.ok) {
          setSentTo(email);
          dismissTimer.current = window.setTimeout(() => {
            setOpen(false);
          }, SUCCESS_DWELL_MS);
          return;
        }

        toast.error("That invitation was not sent", {
          description: result.message,
        });
      } catch (cause) {
        console.error("[console] invite threw:", cause);
        toast.error("We couldn't reach the server", {
          description: "Check your connection and try again.",
        });
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-tap">
          <UserPlusIcon aria-hidden="true" />
          Invite someone
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-dialog-max-h overflow-y-auto sm:max-w-2xl">
        {sentTo ? (
          <div className="flex flex-col items-center py-4 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300 motion-safe:ease-out">
            <DialogHeader className="sr-only">
              <DialogTitle>Invitation sent</DialogTitle>
              <DialogDescription>
                {sentTo} has been emailed a link to choose a password.
              </DialogDescription>
            </DialogHeader>

            <span
              aria-hidden="true"
              className="flex size-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-(--shadow-md) motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500 motion-safe:ease-out"
            >
              <CheckIcon className="size-7" />
            </span>

            <p
              role="status"
              aria-live="polite"
              className="mt-5 font-display text-console-title font-medium text-text-primary"
            >
              Invitation sent
            </p>

            <p className="mt-2 max-w-xs text-console-body text-text-secondary text-pretty">
              We emailed{" "}
              <span className="font-data text-text-primary">{sentTo}</span> a
              link to choose a password. It works once and lasts {inviteLinkLifetimeLabel()}.
            </p>
          </div>
        ) : (
          <form action={submit}>
            <DialogHeader>
              <DialogTitle className="text-console-title font-medium">
                Invite someone to the console
              </DialogTitle>
              <DialogDescription>
                They choose their own password from a link sent to this
                address. Nothing passes through you.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field className="gap-2">
                  <FieldLabel htmlFor="invite-name" className={LABEL}>
                    Full name
                  </FieldLabel>
                  <Input
                    id="invite-name"
                    name="fullName"
                    required
                    maxLength={STAFF_INPUT_LIMITS.name}
                    autoComplete="off"
                    disabled={pending}
                    placeholder="Layla Haddad"
                    className={CONTROL}
                  />
                  <FieldDescription className="text-micro">
                    As it should appear on the staff list.
                  </FieldDescription>
                </Field>

                <Field className="gap-2">
                  <FieldLabel htmlFor="invite-email" className={LABEL}>
                    Email
                  </FieldLabel>
                  <Input
                    id="invite-email"
                    maxLength={STAFF_INPUT_LIMITS.email}
                    name="email"
                    type="email"
                    inputMode="email"
                    required
                    autoComplete="off"
                    disabled={pending}
                    placeholder="name@wellplace.example"
                    className={CONTROL}
                  />
                  <FieldDescription className="text-micro">
                    They must sign in with exactly this address.
                  </FieldDescription>
                </Field>
              </div>

              <Field className="gap-2">
                <span className={LABEL}>Role</span>
                <RadioGroup
                  value={role}
                  onValueChange={(value) =>
                    setRole(value as "reception" | "management")
                  }
                  disabled={pending}
                  aria-label="Role"
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  <Label htmlFor="role-reception" className={ROLE_CARD}>
                    <RadioGroupItem
                      value="reception"
                      id="role-reception"
                      className="mt-0.5"
                    />
                    <span className="block">
                      <span className="block font-medium text-text-primary">
                        Reception
                      </span>
                      <span className="block text-micro text-text-muted text-pretty">
                        Day-to-day operations. Cannot see confidential figures
                        or manage staff.
                      </span>
                    </span>
                  </Label>

                  <Label htmlFor="role-management" className={ROLE_CARD}>
                    <RadioGroupItem
                      value="management"
                      id="role-management"
                      className="mt-0.5"
                    />
                    <span className="block">
                      <span className="block font-medium text-text-primary">
                        Management
                      </span>
                      <span className="block text-micro text-text-muted text-pretty">
                        Everything Reception can do, plus the waitlist, staff
                        and settings.
                      </span>
                    </span>
                  </Label>
                </RadioGroup>
                <FieldDescription className="text-micro">
                  The role can be changed later from the staff list.
                </FieldDescription>
              </Field>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                className="h-tap px-4"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-tap px-4" disabled={pending}>
                {pending && (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="motion-safe:animate-spin"
                  />
                )}
                {pending ? "Sending…" : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
