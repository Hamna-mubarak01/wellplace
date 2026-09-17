import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readStaffSession } from "@/lib/auth/session";
import { NOTICE_COOKIE, isAuthNotice } from "@/lib/auth/return-to";
import { homeForRole } from "@/lib/auth/console";
import { ConsoleAuthShell } from "@/components/console/console-auth-shell";
import { SignInForm } from "@/components/console/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  const session = await readStaffSession();
  if (session) redirect(homeForRole(session.role));

  const notice = (await cookies()).get(NOTICE_COOKIE)?.value;
  const linkError =
    isAuthNotice(notice) && notice !== "account_switched" ? notice : undefined;

  return (
    <ConsoleAuthShell
      heroSrc="/renderings/reception-sitting-areaa-view-5-1920.webp"
      heroAlt="The WellPlace reception, in warm timber and stone."
      heroFocus="50% 45%"
    >
      <SignInForm linkError={linkError} />
    </ConsoleAuthShell>
  );
}
