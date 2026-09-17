import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/db/server";
import {
  NOTICE_COOKIE,
  NOTICE_MAX_AGE,
  type AuthNotice,
} from "@/lib/auth/return-to";

const ALLOWED: ReadonlySet<string> = new Set(["recovery", "invite", "email", "magiclink"]);

async function bounce(origin: string, notice: AuthNotice) {
  const store = await cookies();
  store.set(NOTICE_COOKIE, notice, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NEXT_PUBLIC_APP_ENV === "production",
    path: "/",
    maxAge: NOTICE_MAX_AGE,
  });
  return NextResponse.redirect(`${origin}/sign-in`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const type = url.searchParams.get("type") ?? "recovery";
  const origin = url.origin;

  if (!token || !ALLOWED.has(type)) {
    return bounce(origin, "link_invalid");
  }

  const supabase = await createClient();

  const { data: { user: before } } = await supabase.auth.getUser();

  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: token,
  });

  if (error) {
    console.error("[auth] token verification failed:", error.message);
    return bounce(origin, "link_expired");
  }

  const { data: { user: after } } = await supabase.auth.getUser();

  if (before && after && before.id !== after.id) {
    const store = await cookies();
    store.set(NOTICE_COOKIE, "account_switched" satisfies AuthNotice, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NEXT_PUBLIC_APP_ENV === "production",
      path: "/",
      maxAge: NOTICE_MAX_AGE,
    });
  }

  return NextResponse.redirect(`${origin}/set-password`);
}
