import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { cookies } from "next/headers";

import { NOTICE_COOKIE } from "@/lib/auth/return-to";
import { AuthNotice } from "@/components/console/auth-notice";
import { createClient } from "@/lib/db/server";
import { ConsoleAuthShell } from "@/components/console/console-auth-shell";
import { SetPasswordForm } from "@/components/console/set-password-form";

export const metadata: Metadata = {
  title: "Choose a password",
  robots: { index: false, follow: false },
};

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const switched =
    (await cookies()).get(NOTICE_COOKIE)?.value === "account_switched";

  return (
    <ConsoleAuthShell
      heroSrc="/renderings/suite-view-1-1920.webp"
      heroAlt="A WellPlace suite, in warm timber and stone."
      heroFocus="50% 50%"
    >
      <p className="text-console-label font-medium tracking-label text-text-muted uppercase">
        WellPlace console
      </p>
      <h1 className="mt-2 text-console-title font-medium text-text-primary">
        Choose a password
      </h1>
      <p className="mt-2 text-console-body text-text-secondary text-pretty">
        You are setting the password for{" "}
        <span className="font-data text-text-primary">{user.email}</span>. Your
        console access starts once it is saved.
      </p>

      {switched && (
        <AuthNotice
          tone="warning"
          title="This is a different account"
          className="mt-4"
        >
          Following that link signed this browser out of the account it was
          using and signed it in as{" "}
          <span className="font-data">{user.email}</span>. If that was not what
          you meant, close this page and sign in again as yourself.
        </AuthNotice>
      )}

      <SetPasswordForm className="mt-6" />
    </ConsoleAuthShell>
  );
}
