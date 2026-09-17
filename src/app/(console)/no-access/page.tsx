import type { Metadata } from "next";
import Link from "next/link";

import { CONSOLE_HOME, isConsoleId } from "@/lib/auth/console";
import { Button } from "@/components/shared/button";
import { SignOutButton } from "@/components/console/sign-out-button";
import { SplitHeroShell } from "@/components/shared/split-hero-shell";

export const metadata: Metadata = {
  title: "No access",
  robots: { index: false, follow: false },
};

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const requested = (await searchParams).console;
  const wrongConsole =
    typeof requested === "string" && isConsoleId(requested) ? requested : null;

  return (
    <SplitHeroShell
      heroSrc="/renderings/staircase-corridor-upstair-01-1920.webp"
      heroAlt="The WellPlace staircase, in warm timber and stone."
      heroFocus="50% 45%"
    >
      {wrongConsole === "manage" ? (
        <>
          <h1 className="font-display text-headline font-medium tracking-headline text-text-primary text-pretty">
            This page is in the Management console
          </h1>
          <p className="mt-3.5 max-w-lead text-lead text-text-secondary text-pretty">
            Your account signs in to Reception. Ask someone with Management
            access if you need to work in there.
          </p>

          <Button
            asChild
            className="mt-(--space-heading-gap) h-control rounded-(--radius-card) w-full text-control font-semibold"
          >
            <Link href={CONSOLE_HOME.reception}>Back to Reception</Link>
          </Button>

          <SignOutButton
            variant="link"
            className="mt-2 h-tap w-full text-console-body"
          />
        </>
      ) : wrongConsole === "reception" ? (
        <>
          <h1 className="font-display text-headline font-medium tracking-headline text-text-primary text-pretty">
            This page is in the Reception console
          </h1>
          <p className="mt-3.5 max-w-lead text-lead text-text-secondary text-pretty">
            Your account signs in to Management. The front desk runs the day
            itself; ask a receptionist if something there needs changing.
          </p>

          <Button
            asChild
            className="mt-(--space-heading-gap) h-control rounded-(--radius-card) w-full text-control font-semibold"
          >
            <Link href={CONSOLE_HOME.manage}>Back to Management</Link>
          </Button>

          <SignOutButton
            variant="link"
            className="mt-2 h-tap w-full text-console-body"
          />
        </>
      ) : (
        <>
          <h1 className="font-display text-headline font-medium tracking-headline text-text-primary text-pretty">
            This account has no console access
          </h1>
          <p className="mt-3.5 max-w-lead text-lead text-text-secondary text-pretty">
            You are signed in, but there is no active staff record for this
            address. Ask someone with Management access to invite you, then sign
            in again with the address they used.
          </p>

          <SignOutButton className="mt-(--space-heading-gap) h-control rounded-(--radius-card) w-full text-control font-semibold" />
        </>
      )}
    </SplitHeroShell>
  );
}
