"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { claimInvitationIfAny } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { checkRateLimit } from "@/lib/services/rate-limit";
import {
  findStaffAccount,
  sendPasswordReset,
} from "@/lib/services/staff-access-service";
import { RETURN_TO_COOKIE, safeReturnPath } from "@/lib/auth/return-to";
import type { StaffRole } from "@/lib/auth/session";

const credentialsSchema = z.object({
  email: z.email("Enter the email address your invitation was sent to."),
  password: z.string().min(1, "Enter your password."),
});

const emailOnlySchema = z.object({
  email: z.email("Enter the email address your invitation was sent to."),
});

export type SignInResult =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "rejected" }
  | { status: "deactivated" }
  | { status: "rate_limited" }
  | { status: "error" };

export type ResetResult =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "invalid"; message: string }
  | { status: "rate_limited" }
  | { status: "error" };

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

async function consumeReturnTo(role: StaffRole | null): Promise<string> {
  const store = await cookies();
  const target = safeReturnPath(store.get(RETURN_TO_COOKIE)?.value, role);
  store.delete(RETURN_TO_COOKIE);
  return target;
}

export async function signIn(
  _previous: SignInResult,
  formData: FormData,
): Promise<SignInResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "invalid", message: parsed.error.issues[0].message };
  }

  const email = parsed.data.email.trim().toLowerCase();

  const verdict = checkRateLimit(`console:password:${email}`, 8, 15);
  if (!verdict.allowed) return { status: "rate_limited" };

  let role: StaffRole | null = null;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });

    if (error) {
      console.warn("[console] sign-in rejected for", email, "-", error.message);
      return { status: "rejected" };
    }

    await claimInvitationIfAny(supabase);

    const lookup = await findStaffAccount(email);

    if (lookup.outcome === "found" && !lookup.staff.isActive) {
      await supabase.auth.signOut();
      console.warn("[console] sign-in refused — deactivated account:", email);
      return { status: "deactivated" };
    }

    if (lookup.outcome === "found") role = lookup.staff.role;
  } catch (cause) {
    console.error("[console] sign-in fault:", cause);
    return { status: "error" };
  }

  redirect(await consumeReturnTo(role));
}

export async function requestPasswordReset(
  _previous: ResetResult,
  formData: FormData,
): Promise<ResetResult> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "invalid", message: parsed.error.issues[0].message };
  }

  const email = parsed.data.email.trim().toLowerCase();

  const verdict = checkRateLimit(`console:reset:${email}`, 3, 15);
  if (!verdict.allowed) return { status: "rate_limited" };

  try {
    const lookup = await findStaffAccount(email);

    if (lookup.outcome === "failed") {
      console.error(
        "[console] reset aborted — the staff lookup failed. This is almost " +
          "always a stale Supabase service key in the environment:",
        lookup.message,
      );
      return { status: "error" };
    }

    if (lookup.outcome === "found" && lookup.staff.isActive) {
      const sent = await sendPasswordReset({
        email,
        fullName: lookup.staff.fullName,
        origin: await origin(),
      });

      if (!sent.ok) return { status: "error" };
    }

    return { status: "sent" };
  } catch (cause) {
    console.error("[console] reset fault:", cause);
    return { status: "error" };
  }
}

export type SignOutResult = { ok: true } | { ok: false; message: string };

export async function signOut(): Promise<SignOutResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error(`[auth] sign out failed: ${error.message}`);
      return { ok: false, message: "We could not sign you out. Please try again." };
    }
    return { ok: true };
  } catch (cause) {
    console.error(
      "[auth] sign out failed:",
      cause instanceof Error ? cause.message : "Unknown failure",
    );
    return {
      ok: false,
      message: "We could not reach the sign-in service. Please try again.",
    };
  }
}
